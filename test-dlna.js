#!/usr/bin/env node

const util = require('util');
const dlna = require( './dlna' )

////////////////////////////////////////////////////////////////////
// COMMAND LINE DRIVER
////////////////////////////////////////////////////////////////////
// options:
let args = [];
let VERBOSE=false;
let DEBUG=false;
const SCRIPT = "./" + process.argv[1].replace(/^.+\//,'');

/////////////////////////////////////
// scan command line args:
function usage()
{
  console.log( `${SCRIPT} - command line script to access dlna/upnp MediaServer devices on the network` );
  console.log( `Usage:
   ${SCRIPT} <cmd>         (info | content | meta .... discover | get | post)
   ${SCRIPT} --help        (this help)
   ${SCRIPT} --verbose     (output verbose information)
   ${SCRIPT} --debug       (output debug data)

Usage:
   ${SCRIPT} info                                   # show descriptions for all MediaServer devices on the local network
   ${SCRIPT} info <desc_url>                        # show description for one MediaServer device
   ${SCRIPT} content <contentdir_control_url>       # show content listing for MediaServer's root (id=0) object
   ${SCRIPT} content <contentdir_control_url>  <id> # show content listing for MediaServer's <id> object
   ${SCRIPT} meta    <contentdir_control_url>  <id> # show metadata for MediaServer's <id> object

  Low Level API:
   ${SCRIPT} discover                               # show all MediaServer device descriptor URLs on the local network
   ${SCRIPT} get                                    # make a soap/upnp GET  call
   ${SCRIPT} post                                   # make a soap/upnp POST call

Example:
   # browse the local network for UPnP/DLNA content servers:
   ${SCRIPT} discover  # return a list of UPnP/DLNA media devices on the local network
   ${SCRIPT} info      # call discover, look up description info about each one

   # get info about the device:  use one of the desciption "desc_url" urls returned by discover
   ${SCRIPT} info http://192.168.4.106:8200/rootDesc.xml

   # browse for content:            use the device's ContentDirectory "controlURL" (starting at root object 0):
   ${SCRIPT} content http://192.168.4.106:8200/ctl/ContentDir      # defaults to 0
   ${SCRIPT} content http://192.168.4.106:8200/ctl/ContentDir '0'  # same thing

   # browse a subfolder:            use an ID of a sub-folder
   ${SCRIPT} content http://192.168.4.106:8200/ctl/ContentDir '64'

   # browse a sub-subfolder:        use an ID of a sub-folder (again)
   ${SCRIPT} content http://192.168.4.106:8200/ctl/ContentDir '64$2$1B'

   # browse a sub-sub-subfolder:    use an ID of a sub-folder (again)
   ${SCRIPT} content http://192.168.4.106:8200/ctl/ContentDir '64$2$1B$6'

   # browse a sub-sub-subfolder's media:    use an ID of a media object
   ${SCRIPT} content http://192.168.4.106:8200/ctl/ContentDir '64$2$1B$6$B'

   # download the media and art files (listed from previous step):
   curl http://192.168.4.106:8200/MediaItems/67312.mp3 -o 67312.mp3
   curl http://192.168.4.106:8200/AlbumArt/2807-67312.jpg -o 2807-67312.jpg
  ` );
}
let ARGC = process.argv.length-2; // 1st 2 are node and script name...
let ARGV = process.argv;
let non_flag_args = 0;
let non_flag_args_required = 0;
for (let i = 2; i < (ARGC+2); i++) {
  if (ARGV[i] == "--help") {
    usage();
    process.exit( -1 )
  }
  if (ARGV[i] == "--verbose") {
    VERBOSE=true
    continue
  }
  if (ARGV[i] == "--debug") {
    DEBUG=true
    continue
  }
  // example of parsing a --flag with an arg
  // if (ARGV[i] == "--prefix") {
  //   i+=1;
  //   prefix=ARGV[i]
  //   prefix.replace( /\/+$/, '' ) // remove trailing slash if present
  //   VERBOSE && console.log( `Parsing Args: Sample Path Prefix ${prefix} (e.g. ${prefix}/MySample.wav)` )
  //   continue
  // }
  if (ARGV[i].substr(0,2) == "--") {
    console.log( `Unknown option ${ARGV[i]}` );
    process.exit(-1)
  }

  args.push( ARGV[i] )
  VERBOSE && console.log( `Parsing Args: argument #${non_flag_args}: \"${ARGV[i]}\"` )
  non_flag_args += 1
}

// output help if they're getting it wrong...
if (non_flag_args_required != 0 && (ARGC == 0 || !(non_flag_args >= non_flag_args_required))) {
  (ARGC > 0) && console.log( `Expected ${non_flag_args_required} args, but only got ${non_flag_args}` );
  usage();
  process.exit( -1 );
}

// main entrypoint:
(async () => {
  dlna.setDEBUG( DEBUG )
  dlna.setVERBOSE( VERBOSE )

  switch (args[0]) {
    case "info": {
      let result = await dlna.info( args );
      console.log( util.inspect(result, {showHidden: false, depth: null, colors: true}) );

      // Help
      console.log( "" )
      console.log( "Next:" )
      console.log( " - Get info about only one device:")
      console.log( `   - ${SCRIPT} info <desc_url>` );
      console.log( `   - ${SCRIPT} get <desc_url>` );
      console.log( ` - Get content listing for a device:`)
      console.log( `   - ${SCRIPT} content <contentdir_control_url>` );
      break;
    }
    case "content": {
      if (args[1] == undefined) {
        usage();
        process.exit(-1)
      }

      let result = await dlna.content( args );
      console.log( util.inspect(result, {showHidden: false, depth: null, colors: true}) );

      // Help
      console.log( "" )
      console.log( "Next:" )
      console.log( " - Get content listing:")
      console.log( `   - ${SCRIPT} ${args[0]} ${args[1]} <object id>`)
      console.log( " - Get metadata:")
      console.log( `   - ${SCRIPT} meta ${args[1]} <object id>`)
      console.log( " - Download file:")
      console.log( `   - curl <file|art|icon url> --output <filename>`)
      break;
    }
    case "meta": {
      if (args[1] == undefined) {
        console.log( "needs a URL" )
        process.exit(-1);
      }

      let result = await dlna.meta( args );
      console.log( util.inspect(result, {showHidden: false, depth: null, colors: true}) );

      // Help
      console.log( "" )
      console.log( "Next:" )
      console.log( " - Get content listing:")
      console.log( `   - ${SCRIPT} content ${args[1]} <object id>`)
      console.log( " - Get metadata:")
      console.log( `   - ${SCRIPT} ${args[0]} ${args[1]} <object id>`)
      console.log( " - Download file:")
      console.log( `   - curl <file|art|icon url> --output <filename>`)
      break;
    }

    // LOW LEVEL API
    case "discover": {
      let result = await dlna.discover( 'urn:schemas-upnp-org:service:ContentDirectory:1', 0, 2500 );
      console.log( result );

      // Help
      console.log( "" )
      console.log( "Next:" )
      console.log( ` - ${SCRIPT} info <desc_url>  # show info for one device ` );
      console.log( ` - ${SCRIPT} get  <desc_url>  # show raw data for one device` );
      console.log( ` - ${SCRIPT} info             # show info for all devices` );
      console.log( ` - ${SCRIPT} discover         # find devices on network (descriptors)` );
      break;
    }
    case "get":
    case "post": {
      if (args[1] == undefined) {
        console.log( "needs a URL" )
        process.exit(-1);
      }

      let result = await dlna.request( args );
      console.log( util.inspect(result, {showHidden: false, depth: null, colors: true}) );
      break;
    }
    case "request": {
      if (args.length < 6 ) {
        console.log( "Usage: ", `request <GET|POST> <url> <soap_action: urn:schemas-upnp-org:service:ContentDirectory:1#Browse> <object=0> <browse_flag: "BrowseDirectChildren">\n` )
      }
      if (args.length < 3 ) {
        process.exit(-1);
      }

      console.log( `${SCRIPT} ${args.join( " " )}` )
      args.shift();
      console.log( `_request( ${args.join( ", " )} )` )
      let result = await dlna._request( ...args );
      console.log( util.inspect(result, {showHidden: false, depth: null, colors: true}) );
      break;
    }
    default:
      usage();
      process.exit(-1)
      break;
  }
})();

