
// Script to reproduce 500 Error on PATCH /api/notes/:id
// Run with node (v18+)

async function run() {
    console.log('Running 500 Repro Script...');
    try {
        // 1. Login
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@test.com', password: 'test123' })
        });

        if (!loginRes.ok) {
            console.error('Login Failed:', await loginRes.text());
            return;
        }

        let cookie = loginRes.headers.get('set-cookie');
        if (Array.isArray(cookie)) cookie = cookie.join('; ');
        // fetch headers.get('set-cookie') might return string or null in some envs.
        // In node fetch, it might be separate.
        // Noteer uses cookie-parser? Yes.

        console.log('Login OK. Cookie:', cookie);

        // 2. Create Note
        const createRes = await fetch('http://localhost:3000/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
            body: JSON.stringify({ title: 'Debug Repro', content: 'Testing 500' })
        });

        if (!createRes.ok) {
            console.error('Create Failed:', await createRes.text());
            return;
        }

        const note = await createRes.json();
        console.log('Note Created ID:', note.id);

        // 3. Patch Note (Pin)
        console.log('Patching Note (is_pinned: true)...');
        const patchRes = await fetch(`http://localhost:3000/api/notes/${note.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
            body: JSON.stringify({ is_pinned: true })
        });

        console.log('Patch Status:', patchRes.status);
        const text = await patchRes.text();
        console.log('Patch Response Body:', text); // EXPECTING ERROR DETAILS HERE

    } catch (e) {
        console.error('Script Error:', e);
    }
}

run();
