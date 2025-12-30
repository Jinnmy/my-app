# Activity Diagram: Use case 19 (Allocate unmarked files)

```mermaid
graph TD
    Start((Start)) --> UserAction1

    subgraph Admin [Admin]
        UserAction1[Go to Storage Tools]
        UserAction2[Click 'Scan for Unmarked']
        UserAction3[Select Files from Result]
        UserAction4[Assign Target User]
        UserAction5[Click 'Allocate']
    end

    subgraph System [System]
        SysAction1[Scan Disk for Orphaned Files]
        SysCheck1{Files Found?}
        SysAction2[Display List of Files]
        SysAction3[Display 'No Files Found']
        SysCheck2{Read Permission?}
        SysAction4[Assign Ownership in DB]
        SysAction5[Update Usage Metrics]
        SysAction6[Log 'Permission Denied' Error]
        SysAction7[Skip File]
    end

    UserAction1 --> UserAction2
    UserAction2 --> SysAction1
    SysAction1 --> SysCheck1

    %% Scan Result
    SysCheck1 -- No --> SysAction3
    SysAction3 --> End((End))

    SysCheck1 -- Yes --> SysAction2
    SysAction2 --> UserAction3
    UserAction3 --> UserAction4
    UserAction4 --> UserAction5
    UserAction5 --> SysCheck2

    %% Allocation Process
    SysCheck2 -- Yes --> SysAction4
    SysAction4 --> SysAction5
    
    SysCheck2 -- No --> SysAction6
    SysAction6 --> SysAction7
    SysAction7 --> SysAction5

    SysAction5 --> End
```
