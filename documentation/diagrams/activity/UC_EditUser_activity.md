# Activity Diagram: Use case 17 (Edit user)

```mermaid
graph TD
    Start((Start)) --> UserAction1

    subgraph Admin [Admin]
        UserAction1[View User List]
        UserAction2[Select User & Click 'Edit']
        UserAction3[Modify Details (Role/Password/Quota)]
        UserAction4[Click 'Save Updates']
    end

    subgraph System [System]
        SysAction1[Load User Data]
        SysCheck1{Validation Pass?}
        SysAction2[Commit Updates to DB]
        SysAction3[Display Success Message]
        SysAction4[Display Validation Error]
    end

    UserAction1 --> UserAction2
    UserAction2 --> SysAction1
    SysAction1 --> UserAction3
    UserAction3 --> UserAction4
    UserAction4 --> SysCheck1

    %% Validation
    SysCheck1 -- Yes --> SysAction2
    SysAction2 --> SysAction3
    
    SysCheck1 -- No --> SysAction4
    SysAction4 --> UserAction3

    SysAction3 --> End((End))
```
