# File/Folder Soft Delete

This diagram illustrates the process of moving a file or folder to the trash (Soft Delete).

```mermaid
flowchart TD
    Start([User Selects Item]) --> Context[Open Context Menu / Action Bar]
    Context --> ClickDel[Click 'Delete']
    
    ClickDel --> API[Call Soft Delete API]
    
    subgraph Update_DB
        API --> Timestamp[Set moved_to_trash_at = NOW()]
        Timestamp --> Flag[Set is_deleted = 1]
        Flag --> Save[Update Record]
    end
    
    Save --> Success[Return Success]
    Success --> UI([Remove Item from Current View])
```
