import { Hono } from "hono"
import { createWish, deleteWish, fulfillWish, listWishes } from "./db/queries"

const app = new Hono()

app.get("/", (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Wish List</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0 auto; padding: 20px; text-align: center; max-width: 800px; }
    ul { list-style: none; padding: 0; display: inline-block; text-align: left; }
    li { padding: 20px; border: 1px solid #ddd; margin: 5px 0; border-radius: 5px; width: 100%; }
    .fulfilled { background-color: #e8f5e8; text-decoration: line-through; }
    button { margin: 0 5px; padding: 2px 8px; }
    .buttons { overflow: hidden; margin-top: 5px; }
    .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal.hidden { display: none; }
    .modal-content { background: white; padding: 20px; border-radius: 8px; text-align: center; }
  </style>
</head>
<body>
  <h1 style="font-size: 2.5em; padding: 20px 0;">My Wish List</h1>
  <form id="addForm"><input id="newWish" placeholder="Add a wish..." required><button>Add</button></form>
  <ul id="wishes"></ul>
  <div id="modal" class="modal">
    <div class="modal-content">
      <h3>Enter your username</h3>
      <input id="username" placeholder="Username" required>
      <button onclick="setUsername()">Continue</button>
    </div>
  </div>
  <script>
    let username = localStorage.getItem('username');
    const modal = document.getElementById('modal');
    const wishesEl = document.getElementById('wishes');
    const form = document.getElementById('addForm');
    const input = document.getElementById('newWish');

    if (!username) {
      modal.classList.remove('hidden');
    }

    function setUsername() {
      username = document.getElementById('username').value.trim();
      if (username) {
        localStorage.setItem('username', username);
        modal.classList.add('hidden');
        loadWishes();
      }
    }

    async function loadWishes() {
      const res = await fetch('/api/wishes');
      const wishes = await res.json();
      wishesEl.innerHTML = wishes.map(w => \`<li class="\${w.fulfilled ? 'fulfilled' : ''}">
        <div>\${w.item}<br><small>\${w.username}</small></div>
        <div class="buttons">
          <button onclick="fulfill(\${w.id})">✓</button>
          <button onclick="del(\${w.id})" style="float:right">×</button>
        </div>
      </li>\`).join('');
    }

    form.onsubmit = async e => {
      e.preventDefault();
      if (!username) return;
      await fetch('/api/wishes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({item: input.value, username}) });
      input.value = '';
      loadWishes();
    };

    async function fulfill(id) { await fetch(\`/api/wishes/\${id}/fulfill\`, { method: 'PATCH' }); loadWishes(); }
    async function del(id) { await fetch(\`/api/wishes/\${id}\`, { method: 'DELETE' }); loadWishes(); }

    if (username) loadWishes();
  </script>
</body>
</html>`
  return c.html(html)
})

app.get("/api/wishes", (c) => c.json(listWishes()))

app.post("/api/wishes", async (c) => {
  const body = await c.req.json().catch(() => null)
  const item = (body?.item ?? "").toString().trim()
  const username = (body?.username ?? "").toString().trim()
  if (!item) return c.json({ error: "item is required" }, 400)
  if (!username) return c.json({ error: "username is required" }, 400)

  return c.json(createWish(item, username), 201)
})

app.patch("/api/wishes/:id/fulfill", (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400)

  const res = fulfillWish(id)
  if (res.changes === 0) return c.json({ error: "not found" }, 404)

  return c.json({ ok: true })
})

app.delete("/api/wishes/:id", (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400)

  const res = deleteWish(id)
  if (res.changes === 0) return c.json({ error: "not found" }, 404)

  return c.json({ ok: true })
})

export default app
