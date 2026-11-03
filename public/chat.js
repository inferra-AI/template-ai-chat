const conversation = localStorage.getItem('conversation') || crypto.randomUUID();
localStorage.setItem('conversation', conversation);
const list = document.querySelector('#messages');
const status = document.querySelector('#status');
function append(role, content) {
  const item = document.createElement('li');
  item.textContent = `${role}: ${content}`;
  list.append(item);
}
async function load() {
  const response = await fetch(`/api/messages/${conversation}`);
  if (!response.ok) throw new Error('Could not load conversation');
  list.replaceChildren();
  for (const row of await response.json()) append(row.role, row.content);
}
load().catch(error => { status.textContent = error.message; });
document.querySelector('#chat').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.querySelector('#message');
  const button = event.target.querySelector('button');
  button.disabled = true;
  status.textContent = 'Thinking…';
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation, message: input.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    input.value = '';
    await load();
    status.textContent = '';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
