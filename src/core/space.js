import * as THREE from 'three';
// Directions and placement in the bay's frame (forward is -Z, +x east, y up), and scratch values the per-frame code reuses.
// Shared creature orientation: heading yaw, pitch, bank roll. Forward is -Z.
export function orient(obj, yaw, pitch, roll) { obj.rotation.set(0, 0, 0); obj.rotateY(yaw); obj.rotateX(pitch); obj.rotateZ(roll); }   // +pitch = nose up (forward is -Z)
export const fwdInto = (out, yaw, pitch = 0) => out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
export const FWD_POOL = Array.from({ length: 64 }, () => new THREE.Vector3());
export let fwdNext = 0;
export const fwdOf = (yaw, pitch = 0) => fwdInto(FWD_POOL[fwdNext = (fwdNext + 1) & 63], yaw, pitch);   // a pooled vector: use it now, .clone() it to keep it
export const _s = new THREE.Vector3(), _f = new THREE.Vector3(), _M = new THREE.Matrix4(), _E = new THREE.Euler();
// place one instance: position, euler rotation, scale
export function placeInstance(mesh, i, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _E.set(rx, ry, rz); _M.makeRotationFromEuler(_E); if (sx !== 1 || sy !== 1 || sz !== 1) _M.scale(_s.set(sx, sy, sz)); _M.setPosition(x, y, z); mesh.setMatrixAt(i, _M);
}
