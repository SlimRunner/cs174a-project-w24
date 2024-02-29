export function draw_if_ready(object, context, program_state, model_transform, material) {
  if (object.ready) object.draw(context, program_state, model_transform, material);
}