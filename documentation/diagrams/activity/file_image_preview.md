# Image Preview

This diagram illustrates the flow for previewing images in a lightbox.

```mermaid
flowchart TD
    Start([User Clicks Image]) --> Lightbox[Open Lightbox Overlay]
    Lightbox --> DetermineSrc{Is High-Res Needed?}
    
    DetermineSrc -- Yes --> ReqFull[Request Original Image]
    DetermineSrc -- No --> ReqThumb[Request Thumbnail (if available)]
    
    ReqFull --> Serve[Serve Image Blob]
    ReqThumb --> Serve
    
    Serve --> Render[Render in <img> Tag]
    Render --> Display([Show Image])
    
    Display --> Navigation{User Navigates?}
    Navigation -- Next/Prev --> LoadNext[Load Next Image in Folder]
    LoadNext --> DetermineSrc
```
