import { defs, tiny } from "../examples/common.js";

const {
  vec3, vec4, Mat4, Vector3
} = tiny;

export function find_ray_triag_crossing(point, dir, a, b, c) {
  // https://courses.cs.washington.edu/courses/csep557/10au/lectures/triangle_intersection.pdf
  point = vec3(point[0], point[1], point[2]);
  dir = vec3(dir[0], dir[1], dir[2]);
  a = vec3(a[0], a[1], a[2]);
  b = vec3(b[0], b[1], b[2]);
  c = vec3(c[0], c[1], c[2]);
  let q = vec3(0,0,0);

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

export function check_scene_intersection(pos, dir, meshes) {
  let closest_crossing = null, mesh_cross = null, mesh_index = null;
  let triag = null, triag_index = null, min_dist = Infinity;

  // these variables are declared here to avoid declaration in loop
  let crossing = null, cross_dist = null;
  let pos_alias = null, mdl_alias = null, idx_alias = null;
  let triag_vtx = null;

  for (const [msh_idx, mesh] of meshes.entries()) {
    for (let i = 0; i < mesh.object.indices.length; i += 3) {
      pos_alias = mesh.object.arrays.position;
      mdl_alias = mesh.model_transform;
      idx_alias = mesh.object.indices;

      // transform point to world space
      triag_vtx = [
        mdl_alias.times(vec4(...pos_alias[idx_alias[i]], 1)),
        mdl_alias.times(vec4(...pos_alias[idx_alias[i + 1]], 1)),
        mdl_alias.times(vec4(...pos_alias[idx_alias[i + 2]], 1)),
      ]

      crossing = find_ray_triag_crossing(
        pos, dir,
        triag_vtx[0],
        triag_vtx[1],
        triag_vtx[2]
      );

      if (crossing /* exists */) {
        cross_dist = crossing.minus(pos).norm();
        if (cross_dist < min_dist) {
          closest_crossing = crossing;
          triag = triag_vtx;
          mesh_cross = mesh;
          min_dist = cross_dist;
          triag_index = i;
          mesh_index = msh_idx;
        }
      }
    }
  }

  triag = triag?.map(v => vec3(v[0], v[1], v[2])) ?? null;
  const normal = triag ? triag[1].minus(triag[0]).cross(triag[2].minus(1)): 0;

  return {
    mesh: mesh_cross,
    point: closest_crossing,
    distance: min_dist,
    normal: normal,
    triag_index: triag_index,
    mesh_index: mesh_index,
  }
}
