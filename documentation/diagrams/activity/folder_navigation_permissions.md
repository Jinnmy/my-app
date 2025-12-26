# Folder Navigation & Permission Logic

This flow maps the logic for determining file access and listing contents (Ownership vs. Shared access).

```mermaid
flowchart TD
    Start([User Requests Folder View]) --> CheckID{Is FolderID Provided?}
    
    %% Root View Logic
    CheckID -- No (Root) --> FetchOwner[Fetch Files Owned by User (Parent=NULL)]
    FetchOwner --> FetchShared[Fetch Files Shared WITH User]
    FetchShared --> Merge[Merge & Sort Results]
    Merge --> Display([Display File Grid])

    %% Sub-Folder Logic
    CheckID -- Yes (Sub-folder) --> CheckShare{Is Folder Shared with User?}
    
    CheckShare -- Yes --> AllowShared[Grant Access (Shared View)]
    AllowShared --> QueryContent[Query Files where ParentID = FolderID]
    
    CheckShare -- No --> CheckOwn{Is Folder Owned by User?}
    CheckOwn -- Yes --> AllowOwn[Grant Access (Owner View)]
    AllowOwn --> QueryContent
    
    CheckOwn -- No --> Deny[Access Denied / 403 Forbidden]
    Deny --> ErrorPage([Show Error])
    
    QueryContent --> FilterCrypt[Filter Encrypted/Deleted Files]
    FilterCrypt --> Display
```
