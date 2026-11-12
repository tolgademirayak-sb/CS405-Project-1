import { identity, multiply } from "../math/mat4.js";
export class Node {
  constructor(name, local = identity()) {
    this.name = name;
    this.local = local;
    this.world = identity();
    this.parent = null;
    this.children = [];
    this.mesh = null;
  }
  add(child) {
    for (let p = this; p; p = p.parent)
      if (p === child) throw Error("Scene graph cycle");
    if (child.parent)
      child.parent.children = child.parent.children.filter((n) => n !== child);
    child.parent = this;
    this.children.push(child);
    return child;
  }
  update(parent = identity()) {
    this.world = multiply(parent, this.local);
    for (const c of this.children) c.update(this.world);
  }
  visit(fn) {
    fn(this);
    for (const c of this.children) c.visit(fn);
  }
}
