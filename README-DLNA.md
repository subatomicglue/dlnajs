
# Example DLNA content browse and retrieval:
https://developer.sony.com/develop/audio-control-api/get-started/browse-dlna-file#tutorial-step-3

1. Search    `urn:schemas-upnp-org:service:ContentDirectory:1`
2. Identify the media server to browse, and record the IP address and port number from media server’s `LOCATION` field.
3. use the full path from the `LOCATION` field to download the description file for the media server
4.) Locate the `ContentDirectory` service; it will have a serviceType element with a value of
    `urn:schemas-upnp-org:service:ContentDirectory:1`
    Record the value of the associated `controlURL` element.
5. Access the content service using `http://{IP}:{PORT}{controlURL}`
6.) Send a SOAP (http post) (Note, the root directory is always `ObjectID "0"`.)

header:
```
"Content-Type: text/xml; charset=utf-8"
"SOAPAction: \"urn:schemas-upnp-org:service:ContentDirectory:1#Browse\""
```

body:
```
<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">
      <ObjectID>0</ObjectID>
      <BrowseFlag>BrowseDirectChildren</BrowseFlag>
      <Filter>*</Filter>
      <StartingIndex>0</StartingIndex>
      <RequestedCount>0</RequestedCount>
      <SortCriteria></SortCriteria>
    </u:Browse>
  </s:Body>
</s:Envelope>
```

example response:
```
<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:BrowseResponse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><Result><DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/"
xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"
xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
xmlns:dlna="urn:schemas-dlna-org:metadata-1-0/"
xmlns:arib="urn:schemas-arib-or-jp:elements-1-0/"
xmlns:av="urn:schemas-sony-com:av">
<container id="10" restricted="1" parentID="0"><dc:title>USB</dc:title><upnp:class>object.container</upnp:class><av:mediaClass>M</av:mediaClass><av:removableMedia>1</av:removableMedia></container></DIDL-Lite>
</Result><NumberReturned>1</NumberReturned><TotalMatches>1</TotalMatches><UpdateID>52</UpdateID></u:BrowseResponse></s:Body></s:Envelope>
```
we see a container with an id attribute of `"10"`. The title of the container is `"USB"`. This is a subdirectory of the root directory.

8. To get the contents of the subdirectory "10":
```
<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">
      <ObjectID>10</ObjectID>
      <BrowseFlag>BrowseDirectChildren</BrowseFlag>
      <Filter>*</Filter>
      <StartingIndex>0</StartingIndex>
      <RequestedCount>0</RequestedCount>
      <SortCriteria></SortCriteria>
    </u:Browse>
  </s:Body>
</s:Envelope>
```

The result comes back, what a content file looks like:
```
<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:BrowseResponse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><Result><DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/"
xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"
xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
xmlns:dlna="urn:schemas-dlna-org:metadata-1-0/"
xmlns:arib="urn:schemas-arib-or-jp:elements-1-0/"
xmlns:av="urn:schemas-sony-com:av">
<item id="I_01_05_2_-1_00_00_0_35_0_0" restricted="1" parentID="35"><dc:title>01 - Overture.mp3</dc:title><upnp:class>object.item.audioItem.musicTrack</upnp:class><dc:date>2017-05-16T13:37:01</dc:date><res protocolInfo="http-get:*:audio/mpeg:DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_FLAGS=01500000000000000000000000000000">http://192.168.1.119:60151/I_01_05_2_-1_00_00_0_35_0_0</res></item></DIDL-Lite>
</Result><NumberReturned>1</NumberReturned><TotalMatches>1</TotalMatches><UpdateID>52</UpdateID></u:BrowseResponse></s:Body></s:Envelope>
```
The URI is `http://192.168.1.119:60151/I_01_05_2_-1_00_00_0_35_0_0`, and the file ID is `I_01_05_2_-1_00_00_0_35_0_0`.

10.  Before you can play the file, you need its metadata.
```
<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">
      <ObjectID>I_01_05_2_-1_00_00_0_35_0_0</ObjectID>
      <BrowseFlag>BrowseMetadata</BrowseFlag>
      <Filter></Filter>
      <StartingIndex>0</StartingIndex>
      <RequestedCount>0</RequestedCount>
      <SortCriteria></SortCriteria>
    </u:Browse>
  </s:Body>
</s:Envelope>
```

result:
```
<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:BrowseResponse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><Result>&lt;DIDL-Lite xmlns:dc=&quot;http://purl.org/dc/elements/1.1/&quot;
xmlns=&quot;urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/&quot;
xmlns:upnp=&quot;urn:schemas-upnp-org:metadata-1-0/upnp/&quot;
xmlns:dlna=&quot;urn:schemas-dlna-org:metadata-1-0/&quot;
xmlns:arib=&quot;urn:schemas-arib-or-jp:elements-1-0/&quot;
xmlns:av=&quot;urn:schemas-sony-com:av&quot;&gt;
&lt;item id=&quot;I_01_05_2_-1_00_00_0_35_0_0&quot; restricted=&quot;1&quot; parentID=&quot;35&quot;&gt;&lt;dc:title&gt;01 - Overture.mp3&lt;/dc:title&gt;&lt;upnp:class&gt;object.item.audioItem.musicTrack&lt;/upnp:class&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;
</Result><NumberReturned>1</NumberReturned><TotalMatches>1</TotalMatches><UpdateID>52</UpdateID></u
```

# Example URLS for Netgear ReadyNAS 626x
The .xml files can be accessed with simple HTTP get calls (chrome can view it, etc).

The others are HTTP POST requests which require proper SOAP headers and SOAP XML body (see above).

- http://192.168.4.106:8200/rootDesc.xml
  - http://192.168.4.106:8200/ContentDir.xml
    - http://192.168.4.106:8200/ctl/ContentDir
    - http://192.168.4.106:8200/evt/ContentDir
  - http://192.168.4.106:8200/ConnectionMgr.xml
    - http://192.168.4.106:8200/ctl/ConnectionMgr
    - http://192.168.4.106:8200/evt/ConnectionMgr
  - http://192.168.4.106:8200/X_MS_MediaReceiverRegistrar.xml
    - http://192.168.4.106:8200/ctl/X_MS_MediaReceiverRegistrar
    - http://192.168.4.106:8200/evt/X_MS_MediaReceiverRegistrar
