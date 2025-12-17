const fetch = require('node-fetch');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000/api';
let TOKEN = '';
let USER_ID = '';

async function login() {
    // Assuming a test user exists or we can register/login.
    // Based on `users.html`, login api is `/api/users/login`.
    // Let's assume there is a user. If not, we might fail.
    // Try to login with a default or creating one?
    // Let's try to register a temporary user.
    const email = `test${Date.now()}@example.com`;
    const password = 'password123';

    // Register
    try {
        const regRes = await fetch(`${BASE_URL}/users/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Tester', email, password })
        });
        if (!regRes.ok) console.log('Register failed (maybe user exists, trying login)');
    } catch (e) { }

    // Login
    const loginRes = await fetch(`${BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await loginRes.json();
    if (!loginRes.ok) throw new Error('Login failed: ' + data.error);
    TOKEN = data.token;
    USER_ID = data.user.id;
    console.log('Logged in as', email);
}

async function createFolder(name) {
    const res = await fetch(`${BASE_URL}/files/folder`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Create folder failed: ' + data.error);
    console.log('Created folder:', name, data.id);
    return data.id;
}

async function deleteFile(id) {
    const res = await fetch(`${BASE_URL}/files/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Delete failed: ' + data.error);
    console.log('Soft deleted file:', id);
}

async function getTrash() {
    const res = await fetch(`${BASE_URL}/files/trash`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Get trash failed: ' + data.error);
    console.log('Trash count:', data.length);
    return data;
}

async function restoreFile(id) {
    const res = await fetch(`${BASE_URL}/files/restore/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Restore failed: ' + data.error);
    console.log('Restored file:', id);
}

async function permanentDelete(id) {
    const res = await fetch(`${BASE_URL}/files/permanent/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Permanent delete failed: ' + data.error);
    console.log('Permanently deleted file:', id);
}

async function run() {
    try {
        await login();

        // 1. Create a folder
        const folderId = await createFolder(`TrashTest-${Date.now()}`);

        // 2. Soft Delete it
        await deleteFile(folderId);

        // 3. Verify in Trash
        let trash = await getTrash();
        let found = trash.find(f => f.id === folderId);
        if (!found) throw new Error('File not found in trash');
        console.log('Verified file in trash');

        // 4. Restore it
        await restoreFile(folderId);

        // 5. Verify NOT in Trash
        trash = await getTrash();
        found = trash.find(f => f.id === folderId);
        if (found) throw new Error('File still in trash after restore');
        console.log('Verified file removed from trash after restore');

        // 6. Delete again
        await deleteFile(folderId);

        // 7. Permanent Delete
        await permanentDelete(folderId);

        // 8. Verify NOT in Trash and NOT in filesystem (cannot check FS easily remotely, but DB check via trash/list)
        trash = await getTrash();
        found = trash.find(f => f.id === folderId);
        if (found) throw new Error('File still in trash after permanent delete');

        // Check normal list
        const res = await fetch(`${BASE_URL}/files`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const text = await res.text();
        // It might be a list
        const list = JSON.parse(text);
        found = list.find(f => f.id === folderId);
        if (found) throw new Error('File still in normal list after permanent delete');

        console.log('All tests passed!');

    } catch (e) {
        console.error('Test failed:', e);
    }
}

run();
