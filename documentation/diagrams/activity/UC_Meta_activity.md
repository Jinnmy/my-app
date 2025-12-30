# Activity Diagram: UC_Meta (Edit Metadata/Tags)

```mermaid
graph TD
    Start((Start)) --> UserAction1

    subgraph User [User]
        UserAction1[Select File]
        UserAction2[Open Info/Metadata Panel]
        UserAction3[Edit Description/Tags Manually]
        UserAction4[Click 'AI Tag' / 'Auto-Generate']
        UserAction5[Click 'Save']
    end

    subgraph System [System]
        SysAction1[Retrieve Metadata]
        SysAction2[Display Current Metadata]
        SysAction3[Analyze Image/File (AI)]
        SysAction4[Suggest Tags]
        SysAction5[Commit Changes to DB]
        SysCheck1{Save Successful?}
        SysAction6[Update UI]
        SysAction7[Alert 'Save Failed']
    end

    UserAction1 --> UserAction2
    UserAction2 --> SysAction1
    SysAction1 --> SysAction2
    SysAction2 --> UserAction3
    SysAction2 --> UserAction4

    %% AI Flow
    UserAction4 --> SysAction3
    SysAction3 --> SysAction4
    SysAction4 --> UserAction3

    %% Save Flow
    UserAction3 --> UserAction5
    UserAction5 --> SysAction5
    SysAction5 --> SysCheck1

    %% Success/Fail
    SysCheck1 -- Yes --> SysAction6
    SysAction6 --> End((End))

    SysCheck1 -- No --> SysAction7
    SysAction7 --> UserAction5
```
