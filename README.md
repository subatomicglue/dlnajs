# dlna.js - access dlna/upnp MediaServer devices on the network

- dlna.js
  - Javascript lib for accessing dlna/upnp MediaServer devices on the network
- test-dlna.js
  - command line script to access dlna/upnp MediaServer devices on the network (test driver for the lib, and educational)

## Status:
- UseCases solved with this library:
  - Find MediaServers on local network
  - Browse directories and mp3/wav/m4a files from a MediaServer on the local network
- We focus on device discovery and browsing, `MediaServer` devices and their `ContentDirectory` listings (using `BrowseDirectChildren` and `BrowseMetadata`).
- We convert all XML SOAP responses into JavaScript objects (you're welcome), you don't need to work with XML or SOAP with the high level API below.
- If there's something we're missing, let us know.
- WE LOVE MUSIC.

## About DLNA/UPnP:
The [UPnP](https://en.wikipedia.org/wiki/Universal_Plug_and_Play) discovery protocol is known as the Simple Service Discovery Protocol (SSDP).

Universal Plug and Play (UPnP®) and Digital Living Network Alliance (DLNA®) are two sets of guidelines to ensure the compatibility and interoperability of your devices.

DLNA is derived from UPnP specifically for the purpose of media interoperability. The main difference between the two is the scope that they cover. As mentioned above, UPnP is a set of protocols that allow different devices to discover each other and use the services that they can offer.

In general, all DLNA-capable devices are also UPnP-capable since the former is derived from the later.

## Reference, Links:
Sony DLNA documentation:
- *Tutorial: How to browse a DLNA MediaServer*: https://developer.sony.com/develop/audio-control-api/get-started/browse-dlna-file

UPnP documentation:
- *UPnP Tutorial*: http://www.upnp.org/resources/documents/UPnP_UDA_tutorial_July2014.pdf
- *UPnP specs*: https://openconnectivity.org/developer/specifications/upnp-resources/upnp/
  - *MediaServer:1*: http://www.upnp.org/specs/av/UPnP-av-MediaServer-v1-Device.pdf
  - *ContentDirectory:1*: http://www.upnp.org/specs/av/UPnP-av-ContentDirectory-v1-Service.pdf
  - *ConnectionManager:1*: http://www.upnp.org/specs/av/UPnP-av-ConnectionManager-v1-Service.pdf


## Usage:
```
./test-dlna.js - command line script to access dlna/upnp MediaServer devices on the network
Usage:
   ./test-dlna.js <cmd>         (info | content | meta .... discover | get | post)
   ./test-dlna.js --help        (this help)
   ./test-dlna.js --verbose     (output verbose information)
   ./test-dlna.js --debug       (output debug data)

Usage:
   ./test-dlna.js info                                   # show descriptions for all MediaServer devices on the local network
   ./test-dlna.js info <desc_url>                        # show description for one MediaServer device
   ./test-dlna.js content <contentdir_control_url>       # show content listing for MediaServer's root (id=0) object
   ./test-dlna.js content <contentdir_control_url>  <id> # show content listing for MediaServer's <id> object
   ./test-dlna.js meta    <contentdir_control_url>  <id> # show metadata for MediaServer's <id> object

  Low Level API:
   ./test-dlna.js discover                               # show all MediaServer device descriptor URLs on the local network
   ./test-dlna.js get                                    # make a soap/upnp GET  call
   ./test-dlna.js post                                   # make a soap/upnp POST call

Example:
   # browse the local network for UPnP/DLNA content servers:
   ./test-dlna.js discover  # return a list of UPnP/DLNA media devices on the local network
   ./test-dlna.js info      # call discover, look up description info about each one

   # get info about the device:  use one of the desciption "desc_url" urls returned by discover
   ./test-dlna.js info http://192.168.4.106:8200/rootDesc.xml

   # browse for content:            use the device's ContentDirectory "controlURL" (starting at root object 0):
   ./test-dlna.js content http://192.168.4.106:8200/ctl/ContentDir      # defaults to 0
   ./test-dlna.js content http://192.168.4.106:8200/ctl/ContentDir '0'  # same thing

   # browse a subfolder:            use an ID of a sub-folder
   ./test-dlna.js content http://192.168.4.106:8200/ctl/ContentDir '64'

   # browse a sub-subfolder:        use an ID of a sub-folder (again)
   ./test-dlna.js content http://192.168.4.106:8200/ctl/ContentDir '64$2$1B'

   # browse a sub-sub-subfolder:    use an ID of a sub-folder (again)
   ./test-dlna.js content http://192.168.4.106:8200/ctl/ContentDir '64$2$1B$6'

   # browse a sub-sub-subfolder's media:    use an ID of a media object
   ./test-dlna.js content http://192.168.4.106:8200/ctl/ContentDir '64$2$1B$6$B'

   # download the media and art files (listed from previous step):
   curl http://192.168.4.106:8200/MediaItems/67312.mp3 -o 67312.mp3
   curl http://192.168.4.106:8200/AlbumArt/2807-67312.jpg -o 2807-67312.jpg
```

