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
  <div id="pagination" style="margin: 20px 0;"></div>
  <div id="modal" class="modal">
    <div class="modal-content">
      <h3>Enter your username</h3>
      <input id="username" placeholder="Username" required>
      <button onclick="setUsername()">Continue</button>
      <p id="errorMsg" style="color: red; margin: 10px 0 0; display: none;">Please enter a username</p>
    </div>
  </div>
  <div id="deleteModal" class="modal hidden">
    <div class="modal-content">
      <h3>Delete this wish?</h3>
      <button onclick="confirmDelete()">Delete</button>
      <button onclick="cancelDelete()">Cancel</button>
    </div>
  </div>
  <script>
    let username = localStorage.getItem('username');
    const modal = document.getElementById('modal');
    const deleteModal = document.getElementById('deleteModal');
    const wishesEl = document.getElementById('wishes');
    const paginationEl = document.getElementById('pagination');
    const form = document.getElementById('addForm');
    const input = document.getElementById('newWish');
    const usernameInput = document.getElementById('username');
    let wishToDelete = null;
    let currentPage = 1;

    usernameInput.oninput = () => document.getElementById('errorMsg').style.display = 'none';

    if (!username) {
      modal.classList.remove('hidden');
    }

    function setUsername() {
      username = document.getElementById('username').value.trim();
      if (username) {
        localStorage.setItem('username', username);
        modal.classList.add('hidden');
        loadWishes();
      } else {
        document.getElementById('errorMsg').style.display = 'block';
      }
    }

    async function loadWishes(page = 1) {
      currentPage = page;
      const res = await fetch(\`/api/wishes?page=\${page}\`);
      const data = await res.json();
      wishesEl.innerHTML = data.wishes.map(w => \`<li class="\${w.fulfilled ? 'fulfilled' : ''}">
        <div>\${w.item}<br><small>\${w.username}</small></div>
        <div class="buttons">
          <button onclick="fulfill(\${w.id})">✓</button>
          <button onclick="del(\${w.id})" style="float:right">×</button>
        </div>
      </li>\`).join('');
      renderPagination(data.totalPages, page);
    }

    function renderPagination(totalPages, currentPage) {
      if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
      }
      let buttons = [];
      if (currentPage > 1) buttons.push(\`<button onclick="loadWishes(\${currentPage - 1})">←</button>\`);
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(\`<button onclick="loadWishes(\${i})" \${i === currentPage ? 'disabled' : ''}>\${i}</button>\`);
      }
      if (currentPage < totalPages) buttons.push(\`<button onclick="loadWishes(\${currentPage + 1})">→</button>\`);
      paginationEl.innerHTML = buttons.join(' ');
    }

    form.onsubmit = async e => {
      e.preventDefault();
      if (!username) return;
      const itemText = input.value.trim();
      if (!itemText) return;
      input.value = '';
      const tempId = Date.now();
      const tempWish = { id: tempId, item: itemText, username, fulfilled: 0 };
      addWishToUI(tempWish, true);
      try {
        await fetch('/api/wishes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({item: itemText, username}) });
        loadWishes(currentPage);
      } catch (error) {
        removeWishFromUI(tempId);
        alert('Failed to add wish');
      }
    };

    function addWishToUI(wish, isTemp = false) {
      const li = document.createElement('li');
      li.className = wish.fulfilled ? 'fulfilled' : '';
      li.id = \`wish-\${wish.id}\`;
      if (isTemp) li.style.opacity = '0.6';
      li.innerHTML = \`<div>\${wish.item}<br><small>\${wish.username}</small></div>
        <div class="buttons">
          <button onclick="fulfill(\${wish.id})">✓</button>
          <button onclick="del(\${wish.id})" style="float:right">×</button>
        </div>\`;
      const firstWish = wishesEl.querySelector('li');
      if (firstWish) {
        wishesEl.insertBefore(li, firstWish);
      } else {
        wishesEl.appendChild(li);
      }
    }

    function removeWishFromUI(id) {
      const wishEl = document.getElementById(\`wish-\${id}\`);
      if (wishEl) wishEl.remove();
    }

    async function fulfill(id) {
      const wishEl = document.getElementById(\`wish-\${id}\`);
      if (wishEl) wishEl.classList.add('fulfilled');
      try {
        await fetch(\`/api/wishes/\${id}/fulfill\`, { method: 'PATCH' });
        loadWishes(currentPage);
      } catch (error) {
        if (wishEl) wishEl.classList.remove('fulfilled');
        alert('Failed to fulfill wish');
      }
    }

    function del(id) {
      wishToDelete = id;
      deleteModal.classList.remove('hidden');
    }

    async function confirmDelete() {
      if (wishToDelete) {
        const wishEl = document.getElementById(\`wish-\${wishToDelete}\`);
        if (wishEl) wishEl.style.opacity = '0.3';
        try {
          await fetch(\`/api/wishes/\${wishToDelete}\`, { method: 'DELETE' });
          loadWishes(currentPage);
        } catch (error) {
          if (wishEl) wishEl.style.opacity = '1';
          alert('Failed to delete wish');
        }
      }
      deleteModal.classList.add('hidden');
      wishToDelete = null;
    }

    function cancelDelete() {
      deleteModal.classList.add('hidden');
      wishToDelete = null;
    }

    if (username) loadWishes();
  </script>
</body>
</html>`
  return c.html(html)
})

app.get("/api/wishes", (c) => {
  const page = Number(c.req.query("page") || "1")
  const limit = 5
  const wishes = listWishes(page, limit)
  const allWishes = listWishes(1, 1000)
  const totalPages = Math.ceil(allWishes.length / limit)
  return c.json({ wishes, page, limit, totalPages })
})

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
