# PDF Viewer

This diagram illustrates the flow for viewing PDF files in the browser.

```mermaid
flowchart TD
    Start([User Clicks PDF File]) --> UI_Check[Check File Type]
    UI_Check -- PDF --> OpenModal[Open Preview Modal]
    
    OpenModal --> Request[Request File Stream / URL]
    Request --> Backend[Serve Static File / Stream]
    
    Backend --> Frontend[Receive Blob/Stream]
    
    Frontend --> PDFJS[Initialize PDF Renderer (e.g. PDF.js)]
    PDFJS --> Render[Render Pages]
    
    Render --> Display([Display PDF])
```
