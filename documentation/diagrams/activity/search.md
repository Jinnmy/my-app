# Search Workflow

This diagram illustrates the file search functionality.

```mermaid
flowchart TD
    Start([User Enters Search Query]) --> Debounce[Wait for Input Pause (Debounce)]
    Debounce --> API[Call Search API]
    
    subgraph SearchQuery
        API --> Parse[Parse Query Terms]
        Parse --> BuildSQL[Build SQL Query]
        BuildSQL --> Filter[Apply User Permissions Filter]
        Filter --> Execute[Execute Database Query (LIKE / FTS)]
    end
    
    Execute --> Results[Return Matching Records]
    Results --> UI{Has Results?}
    
    UI -- Yes --> Render([Render File List])
    UI -- No --> Empty([Show 'No Results Found'])
```
