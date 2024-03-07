import { defs, tiny } from "../examples/common.js";

const {
  vec3, vec4, Mat4, Vector3
} = tiny;

export function ray_triangle_intersection(point, dir, a, b, c) {
  // https://courses.cs.washington.edu/courses/csep557/10au/lectures/triangle_intersection.pdf
  // debugger;
  point = vec3(point[0], point[1], point[2]);
  dir = vec3(dir[0], dir[1], dir[2]);
  a = vec3(a[0], a[1], a[2]);
  b = vec3(b[0], b[1], b[2]);
  c = vec3(c[0], c[1], c[2]);
  let q = vec3(0,0,0);

  // console.table({point, dir, a, b, c});
  
  const ba = b.minus(a);
  const cb = c.minus(b);
  const ac = a.minus(c);
  const ca = c.minus(a);

  let norm = ba.cross(ca);
  norm.normalize();

  const ND = norm.dot(dir);
  if (ND === 0) {
    return null;
  }
  const t = dir.norm() * norm.dot(a.minus(point)) / ND;
  q = point.plus(dir.times(t));

  if (
    ba.cross(q.minus(a)).dot(norm) >=0 &&
    cb.cross(q.minus(b)).dot(norm) >=0 &&
    ac.cross(q.minus(c)).dot(norm) >=0 &&
    0 <= t
  ) {
    return q;
  }

  return null;
}
