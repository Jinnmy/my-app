# Activity Diagram: UC_Share (Share Links)

```mermaid
graph TD
    Start((Start)) --> UserAction1

    subgraph User [User]
        UserAction1[Select File]
        UserAction2[Click 'Share']
        UserAction3[Set Expiration Date (Optional)]
        UserAction4[Copy Link]
        UserAction5[Revoke Link]
    end

    subgraph System [System]
        SysCheck1{File Shared Already?}
        SysAction1[Generate Unique Link Token]
        SysAction2[Save Link with Expiry]
        SysAction3[Display Link to User]
        SysAction4[Mark Link Inactive/Delete]
        SysAction5[External Access Check]
    end

    subgraph ExternalUser [External User]
        ExtAction1[Access Share Link]
        ExtAction2[View/Download File]
        ExtAction3[See 'Link Expired']
    end

    UserAction1 --> UserAction2
    UserAction2 --> UserAction3
    UserAction3 --> SysAction1
    SysAction1 --> SysAction2
    SysAction2 --> SysAction3
    SysAction3 --> UserAction4

    %% Revocation
    UserAction2 --> UserAction5
    UserAction5 --> SysAction4

    %% usage flow
    UserAction4 -.-> ExtAction1
    ExtAction1 --> SysAction5
    SysAction5 -- Valid --> ExtAction2
    SysAction5 -- Invalid/Expired --> ExtAction3

    ExtAction2 --> End((End))
    ExtAction3 --> End
```
