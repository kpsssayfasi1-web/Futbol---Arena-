// Small helper around Material.onBeforeCompile: inject uniforms and replace
// three.js shader chunks by name.
export function patchMaterial(material, { key, uniforms = {}, defines = {}, vertexPars = '', fragmentPars = '', vertex = {}, fragment = {}, fragmentMainStart = '' }) {
  material.defines = { ...(material.defines || {}), ...defines };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    let vs = shader.vertexShader.replace('#include <common>', () => `#include <common>\n${vertexPars}`);
    let fs = shader.fragmentShader.replace('#include <common>', () => `#include <common>\n${fragmentPars}`);
    for (const [chunk, code] of Object.entries(vertex)) vs = replaceChunk(vs, chunk, code);
    for (const [chunk, code] of Object.entries(fragment)) fs = replaceChunk(fs, chunk, code);
    if (fragmentMainStart) fs = fs.replace('void main() {', () => `void main() {\n${fragmentMainStart}`);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => key;
  return material;
}

function replaceChunk(src, chunk, code) {
  const tag = `#include <${chunk}>`;
  if (!src.includes(tag)) throw new Error(`shader chunk not found: ${chunk}`);
  const body = code.split('$ORIGINAL').join(tag);
  return src.replace(tag, () => body);
}
