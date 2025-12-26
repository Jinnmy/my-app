# Vault Setup

This diagram illustrates the process of enabling and configuring the personal vault.

```mermaid
flowchart TD
    Start([User Opens Settings]) --> Toggle[Enable 'Vault' Feature]
    Toggle --> Modal[Show Setup Modal]
    
    Modal --> Input[Enter Vault Password]
    Input --> Confirm[Confirm Password]
    
    Confirm --> Submit[Click 'Enable Vault']
    
    subgraph Security_Setup
        Submit --> Salt[Generate Salt]
        Salt --> Hash[Hash Password with Salt (Argon2/Bcrypt)]
        Hash --> API[Send Hash/Salt to API]
        
        API --> UpdateUser[Update 'users' Table]
        UpdateUser --> SetFlag[Set vault_enabled = 1]
    end
    
    SetFlag --> Success[Return Success]
    Success --> UI([Vault is Now Active])
```
