# Activity Diagram: Use case 20 (Manage AI features)

```mermaid
graph TD
    Start((Start)) --> UserAction1

    subgraph Admin [Admin]
        UserAction1[Navigate to AI Settings]
        UserAction2[Check Model Status]
        UserAction3[Click 'Download Models']
        UserAction4[Click 'Offload Models']
    end

    subgraph System [System]
        SysAction1[Display Installed Models]
        SysCheck1{Action Type?}
        SysAction2[Initiate Background Download]
        SysAction3[Delete Model Files]
        SysCheck2{Download Success?}
        SysAction4[Enable AI Features]
        SysAction5[Disable AI Features/Free Space]
        SysAction6[Alert 'Download Failed']
    end

    UserAction1 --> UserAction2
    UserAction2 --> SysAction1
    SysAction1 --> SysCheck1

    %% Actions
    UserAction3 --> SysCheck1
    UserAction4 --> SysCheck1

    %% Branch
    SysCheck1 -- Download --> SysAction2
    SysCheck1 -- Offload --> SysAction3

    %% Download Result
    SysAction2 --> SysCheck2
    SysCheck2 -- Yes --> SysAction4
    SysCheck2 -- No --> SysAction6

    %% Offload Result
    SysAction3 --> SysAction5

    SysAction4 --> End((End))
    SysAction5 --> End
    SysAction6 --> End
```
