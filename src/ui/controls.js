export function group(title, note = "") {
  const box = document.createElement("section");
  box.className = "group";
  box.innerHTML = `<h2>${title}</h2>${note ? `<p>${note}</p>` : ""}`;
  document.querySelector("#controls").append(box);
  return box;
}
export function slider(box, label, key, min, max, step, state) {
  const l = document.createElement("label");
  l.innerHTML = `<span>${label}</span><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}"><output>${state[key]}</output>`;
  l.querySelector("input").oninput = (e) => {
    state[key] = +e.target.value;
    l.querySelector("output").value = Number(state[key]).toFixed(
      step < 1 ? 2 : 0,
    );
  };
  box.append(l);
}
export function check(box, label, key, state) {
  const l = document.createElement("label");
  l.innerHTML = `<span>${label}</span><input id="${key}" type="checkbox" ${state[key] ? "checked" : ""}>`;
  l.querySelector("input").onchange = (e) => (state[key] = e.target.checked);
  box.append(l);
}
export function select(box, label, key, values, state) {
  const l = document.createElement("label");
  l.innerHTML = `<span>${label}</span><select id="${key}">${values.map((v) => `<option ${v === state[key] ? "selected" : ""}>${v}</option>`).join("")}</select>`;
  l.querySelector("select").onchange = (e) => (state[key] = e.target.value);
  box.append(l);
}
export function button(box, text, id, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.id = id;
  b.onclick = fn;
  box.append(b);
}
export function download(name, contents, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contents], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
