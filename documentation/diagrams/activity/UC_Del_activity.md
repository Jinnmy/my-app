# Activity Diagram: UC_Del (Delete/Restore Files)

```mermaid
graph TD
    Start((Start)) --> UserAction1

    subgraph User [User]
        UserAction1[Select File(s)]
        UserAction2[Click 'Delete' (Soft Delete)]
        UserAction3[Go to Trash/Bin]
        UserAction4[Select Trashed File]
        UserAction5[Click 'Restore']
        UserAction6[Click 'Delete Permanently']
        UserAction7[Click 'Empty Trash']
    end

    subgraph System [System]
        SysCheck1{File Locked/In Use?}
        SysAction1[Mark File as Deleted (Soft)]
        SysAction2[Move to Trash View]
        SysAction3[Deny Action & Alert]
        SysAction4[Restore File to Original Path]
        SysAction5[Remove from DB & Disk (Hard)]
        SysAction6[Delete All in Trash]
        SysAction7[Update Storage Quota]
    end

    UserAction1 --> UserAction2
    UserAction2 --> SysCheck1

    %% Soft Delete Flow
    SysCheck1 -- No --> SysAction1
    SysAction1 --> SysAction2
    SysCheck1 -- Yes --> SysAction3

    %% Trash Operations
    SysAction2 --> UserAction3
    UserAction3 --> UserAction4
    
    %% Restore
    UserAction4 --> UserAction5
    UserAction5 --> SysAction4
    
    %% Permanent Delete
    UserAction4 --> UserAction6
    UserAction6 --> SysAction5
    SysAction5 --> SysAction7
    
    %% Empty Trash
    UserAction3 --> UserAction7
    UserAction7 --> SysAction6
    SysAction6 --> SysAction7

    SysAction4 --> End((End))
    SysAction7 --> End
    SysAction3 --> End
```
