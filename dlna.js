const util = require('util');
const ssdp = require('node-ssdp').Client
const xml2js = require('xml2js');
const xml2js_parser = new xml2js.Parser(/* options */);
//const httpRequest = require('./http-request').init( { request: require('request') }).httpRequest
const xhr = require( 'xhrjs/xhr' ).init( require("xmlhttprequest").XMLHttpRequest ).xhr
//const fs = require( "fs" );
//const exec = util.promisify(require('child_process').exec);

let VERBOSE=false;
let DEBUG=false;


////////////////////////////////////
// Sony DLNA documentation:
// https://developer.sony.com/develop/audio-control-api/get-started/browse-dlna-file
// UPnP docs:
// https://openconnectivity.org/developer/specifications/upnp-resources/upnp/
// http://www.upnp.org/resources/documents/UPnP_UDA_tutorial_July2014.pdf
// http://www.upnp.org/specs/av/UPnP-av-MediaServer-v1-Device.pdf
// http://www.upnp.org/specs/av/UPnP-av-ContentDirectory-v1-Service.pdf
// http://www.upnp.org/specs/av/UPnP-av-ConnectionManager-v1-Service.pdf
////////////////////////////////////

function summarizeMediaServerDesc( content_result ) {
  if (content_result && content_result.error != undefined)
    return content_result;

  let data = {
    name: content_result.root.device[0].friendlyName[0],
    deviceType: content_result.root.device[0].deviceType[0],
    modelname: content_result.root.device[0].modelName[0],
    modeldesc: content_result.root.device[0].modelDescription[0],
    modelnum: content_result.root.device[0].modelNumber[0],
    manufacturer: content_result.root.device[0].manufacturer[0],
    serviceList: {},
    icons: [],
  };

  for (let device of content_result.root.device) {
    for (let serviceList of device.serviceList) {
      for (let service of serviceList.service) {
        if (data.serviceList[service.serviceType] != undefined) {
          console.log( `[WARNING]  duplicate entries for '${service.serviceType}'...` );
        }
        data.serviceList[service.serviceType] = {};
        for (let key in service) {
          data.serviceList[service.serviceType][key] = service[key][0];
        }
      }
    }

    for (let iconList of device.iconList) {
      for (let icon of iconList.icon) {
        data.icons.push( icon );
      }
    }  
  }
  return data;
}

function didlToDict( soap ) {
  let data = {};
  if (soap['DIDL-Lite'].container)
    for (let item of soap['DIDL-Lite'].container) {
      let id = item['$'].id;
      if (data[id]) {
        console.log( "============================================" )
        console.log( "ERROR: COLLISION", data[id], "and", item );
      }
      data[id] = item;
    }
  if (soap['DIDL-Lite'].item)
    for (let item of soap['DIDL-Lite'].item) {
      let id = item['$'].id;
      if (data[id]) {
        console.log( "============================================" )
        console.log( "ERROR: COLLISION", data[id], "and", item );
      }
      data[id] = item;
    }
  return data;
}

function findPathIn( item, path ) {
  let keys = path.split( '/' )
  //console.log( item)
  let some = false;
  for (let key of keys) {
    //if (key.match( /[0-9]/ )) { key = key}
    if (item[key])
      item = item[key]
    else {
      //if (some) console.log( "bailing at ", path, key, item)
      return undefined
    }
    some = true
  }
  return item;
}

function itemRemap( item ) {
  let result_item = {}
  let src_dst = [
    ['upnp:class/0', 'class'],
    ['dc:title/0', 'title'],
    ['$/id', 'id'],
    ['$/parentID', 'parentID'],
    ['dc:album/0', 'album'],
    ['upnp:album/0', 'album'],
    ['dc:creator/0', 'artist'],
    ['upnp:artist/0', 'artist'],
    ['upnp:genre/0', 'genre'],
    ['res/0/_', 'file'],
    ['res/0/$/size', 'file_size'],
    ['res/0/$/duration', 'file_duration'],
    ['upnp:albumArtURI/0/_', 'art'],
    ['upnp:icon/0', 'icon'],
    ['dc:description/0', 'description'],
    ['dc:longDescription/0', 'long_description'],
  ]
  for (let sd of src_dst) {
    let path = sd[0];
    let value = findPathIn( item, path )
    if (value) {
      let key = sd[1];
      //console.log( key, value )
      result_item[key] = value;
    }
  }
  return result_item;
}

async function resolveSoapEnvelopeResult( result ) {
  // console.log( result )
  // console.log( "0----------------------------------", findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/Result" ) )
  // if there's a soap envelope...result structure, that's the real data... return that instead
  if (findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/Result" ) != undefined) {
    // console.log( "1----------------------------------" )
    let type = findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/$/xmlns:u" )
    switch (type) {
      case 'urn:schemas-upnp-org:service:ContentDirectory:1': {
        let soap = await xml2js_parser.parseStringPromise( result['s:Envelope']['s:Body'][0]['u:BrowseResponse'][0]['Result'][0] ) // we like JSON, ex-or-cize the SOAP demons!
        result['s:Envelope']['s:Body'][0]['u:BrowseResponse'][0]['Result'][0] = soap;
      }
      default: {
        VERBOSE && console.log( "unknown soap xmlns:u type: ", type )
      }
    }
  }
  return undefined;
}

// since we sometimes return the soap result, we like to pack a few things into it for the caller
function appendUsefulThingsToSoapEnvelopeResult( result ) {
  let soap = findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/Result/0" )
  if (soap) {
    soap.status = result.status
    let num_returned = findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/NumberReturned/0" )
    let total_matches = findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/TotalMatches/0" )
    if (num_returned) soap.num_returned = num_returned
    if (total_matches) soap.total_matches = total_matches
  }
}

//////////////////////////////////////////////////////
// PUBLIC (exported) API
//////////////////////////////////////////////////////

// make a low-level ssdp discovery call over the network for UPnP/DLNA media devices
// servicename:
// - "urn:schemas-upnp-org:service:ContentDirectory:1"
// - "urn:schemas-upnp-org:device:MediaServer:1"
function discover( servicename = 'urn:schemas-upnp-org:service:ContentDirectory:1', repeat_interval_msec=0, timeout_interval_msec=10000 ) {
  return new Promise( (rs, rj) => {
    let result = {};
    let client = new ssdp( {} )
    client.on('notify', function () {
      VERBOSE && console.log( "[discover] notify:")
    })

    client.on('response', function inResponse(headers, status, rinfo) {
      VERBOSE && console.log( "[discover] response:")
      /*
        headers: {
          "CACHE-CONTROL": "max-age=1810",
          "DATE": "Tue, 05 Jan 2021 22:09:18 GMT",
          "ST": "urn:schemas-upnp-org:service:ContentDirectory:1",
          "USN": "uuid:4d696e69-444c-164e-9d41-b0b98a457ba0::urn:schemas-upnp-org:service:ContentDirectory:1",
          "EXT": "",
          "SERVER": "4.4.190.x86_64.1 DLNADOC/1.50 UPnP/1.0 ReadyDLNA/1.2.1",
          "LOCATION": "http://192.168.4.47:8200/rootDesc.xml",
          "CONTENT-LENGTH": "0"
        }
        rinfo: {
          "address": "192.168.4.47",
          "family": "IPv4",
          "port": 1900,
          "size": 373
        }
      */

      if (status == 200 && headers.SERVER.split( ' ' ).find( r => r == "DLNADOC/1.50" )) {
        VERBOSE && console.log( `[discover] response[DLNA]:  desc[ "${headers.LOCATION}" ]`, `\troot[ "http://${rinfo.address}:${rinfo.port}" ]` );
        result[headers.LOCATION] = {
          desc_url: `${headers.LOCATION}`,
          root_url: `http://${rinfo.address}:${rinfo.port}`,
          addr: rinfo.address,
          port: rinfo.port,
        }
      }
    })

    VERBOSE && console.log( "[discover] initial search" );
    client.search(servicename)

    // Or maybe if you want to scour again (and again) after X seconds
    if (0 < repeat_interval_msec)
      setInterval(function() {
        VERBOSE && console.log( "[discover] additional search" );
        client.search(servicename)
        //client.search('ssdp:all')
      }, repeat_interval_msec )

    // And after X seconds, you want to stop
    setTimeout(() => {
      VERBOSE && console.log( "[discover] stop" );
      client.stop()
      rs( result );
    }, timeout_interval_msec <= 0 ? 2500 : timeout_interval_msec )
  })
}


// make a low-level soap request for UPnP/DLNA
// soap_action:
// - urn:schemas-upnp-org:service:ContentDirectory:1#Browse
// object:
// - 0 for root or use the ID of the object to inspect
// browse_flag:
// - BrowseDirectChildren  (get the object's children)
// - BrowseMetadata        (get the object's metadata)
async function _request( GET_or_POST, url, soap_action="urn:schemas-upnp-org:service:ContentDirectory:1#Browse", object=0, browse_flag="BrowseDirectChildren", starting_index=0, requested_count=0 ) {
  let result = await xhr( GET_or_POST, url,
    {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `${soap_action}`
    },
`<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Browse xmlns:u="${soap_action.replace( /#[^#]+$/, "" )}">
      <ObjectID>${object}</ObjectID>
      <BrowseFlag>${browse_flag}</BrowseFlag>
      <Filter>*</Filter>
      <StartingIndex>${starting_index}</StartingIndex>
      <RequestedCount>${requested_count}</RequestedCount>
      <SortCriteria></SortCriteria>
    </u:Browse>
  </s:Body>
</s:Envelope>`
  )
  if (result.status == 200) {
    let soap = await xml2js_parser.parseStringPromise(result.body); // we like JSON, ex-or-cize the SOAP demons!
    await resolveSoapEnvelopeResult( soap ); // additionally the soap/envelope/result might be xml too... kill that also
    soap.status = result.status
    appendUsefulThingsToSoapEnvelopeResult( soap ); // since I'll often return just this piece, remove the envelope...
    return soap;
  }
  return { msg: "error", status: result.status, error: result.error };
}


// browse content
// args = [ "content", url (required), object_id (optional: default 0) ]
// start = start_of_data (optional: default 0)
// count = amt_of_data   (optional: default 0)
async function content( args, start = 0, count = 0 ) {
  let url = args[1]
  let object_id = args[2] ? args[2] : 0
  let result = await _request( "POST", url, "urn:schemas-upnp-org:service:ContentDirectory:1#Browse", object_id, "BrowseDirectChildren", start, count )
  if (result.status == 200) {
    VERBOSE && console.log( util.inspect(result, {showHidden: false, depth: null, colors: true}))
    let body = findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/Result/0" )
    VERBOSE && console.log( "Result:", util.inspect(body, {showHidden: false, depth: null, colors: true}))
    VERBOSE && console.log( "========================" )
    let items = (body['DIDL-Lite'].container ? body['DIDL-Lite'].container : [] ).concat( body['DIDL-Lite'].item ? body['DIDL-Lite'].item : [] );
    items = items.map( item => itemRemap( item ) )
    return {
      items: items,
      num_returned:  findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/NumberReturned/0" ),
      total_matches: findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/TotalMatches/0" ),
      status: result.status,
    }
  } else {
    VERBOSE && console.log( `ERROR ${result.status}` )
    VERBOSE && console.log( util.inspect(result.error, {showHidden: false, depth: null, colors: true}))
    VERBOSE && console.log( "if you used a \"$\", perhaps your shell interpreted as a variable?, try single ''s" )
    return { msg: "error", error: result.error, status: result.status }
  }
}

// make a raw SOAP/UPNP http request
// args = [ "get" or "post", url (required), object_id (optional: default 0) ]
// start = start_of_data (optional: default 0)
// count = amt_of_data   (optional: default 0)
async function request( args, start = 0, count = 0 ) {
  let GET_or_POST = args[0] == "post" ? "POST" : "GET"
  let url = args[1]
  let object_id = args[2] ? args[2] : 0
  let result = await _request( GET_or_POST, url, "urn:schemas-upnp-org:service:ContentDirectory:1#Browse", object_id, "BrowseDirectChildren", start, count )
  if (result.status == 200) {
    VERBOSE && console.log( util.inspect(result, {showHidden: false, depth: null, colors: true}))
    let body = findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/Result/0" )
    if (body) return body;
    return result // all we got, nothing better, return it
  } else {
    VERBOSE && console.log( `[ERROR] ${result.status}` )
    return { msg: "error", error: result.error, status: result.status }
  }
}

// pull metadata about the content <object id>
// args = [ "meta", url (required), object_id (optional: default 0) ]
async function meta( args ) {
  let url = args[1]
  let object_id = args[2] ? args[2] : 0
  let result = await _request( "POST", url, "urn:schemas-upnp-org:service:ContentDirectory:1#Browse", object_id, "BrowseMetadata", 0, 0 )
  let result_body = findPathIn( result, "s:Envelope/s:Body/0/u:BrowseResponse/0/Result/0" )
  let result_dict = didlToDict( result_body )[object_id]
  let result_dict_remapped = itemRemap( result_dict )
  VERBOSE && console.log( util.inspect(result_dict, {showHidden: false, depth: null, colors: true}))
  VERBOSE && console.log( "===================================")
  return result_dict_remapped
  //console.log( util.inspect(result_dict_remapped, {showHidden: false, depth: null, colors: true}))
}

// get device information
// args = [ "info", device_desc_url (optional: default is to search all devices, and get info for each device's desc_url) ]
async function info( args ) {
  let url = args ? args[1] : undefined;
  let discoveries = url ? { [url]: { desc_url: url } } : await discover( 'urn:schemas-upnp-org:service:ContentDirectory:1', 0, 2500 );
  VERBOSE && console.log( "discoveries: ", util.inspect(discoveries, {showHidden: false, depth: null, colors: true}));
  let data = {};
  for (desc_url in discoveries) {
    let base_url = desc_url.replace( /^([^/]+\/\/[^/]+)\/.*$/, "$1" );
    let root_url = discoveries[desc_url].root_url;
    let result = await _request( "GET", desc_url, "urn:schemas-upnp-org:service:ContentDirectory:1#Browse", 0, "BrowseDirectChildren", 0, 0 );
    if (result.status == 200) {
      VERBOSE && console.log( `"${desc_url}": `, util.inspect(result, {showHidden: false, depth: null, colors: true}));
      let summary = summarizeMediaServerDesc( result );
      data[summary.name] = summary;
      data[summary.name].desc_url = desc_url;
      data[summary.name].root_url = root_url;
      data[summary.name].contentdir_control_url = base_url + summary.serviceList['urn:schemas-upnp-org:service:ContentDirectory:1'].controlURL;
    } else {
      VERBOSE && console.log( `[ERROR] ${result.status}` )
      return { msg: "error", error: result.error, status: result.status }
    }
  }
  VERBOSE && console.log( "================================" );
  return data;
}

// low level API
module.exports.discover = discover;
module.exports._request = _request;
module.exports.request = request;

// high level API
module.exports.info = info;
module.exports.content = content;
module.exports.meta = meta;

// developer API
module.exports.setDEBUG = ( d ) => { DEBUG = d }
module.exports.setVERBOSE = ( v ) => { VERBOSE = v }
