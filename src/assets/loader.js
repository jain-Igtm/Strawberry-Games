import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const gltfLoader = new GLTFLoader();
const modelCache = new Map();

export async function loadModel(url) {
  if (!url) return null;
  if (modelCache.has(url)) return modelCache.get(url);

  const promise = new Promise(resolve => {
    gltfLoader.load(
      url,
      gltf => resolve(gltf.scene),
      undefined,
      () => resolve(null)
    );
  });

  modelCache.set(url, promise);
  return promise;
}

export function cloneModel(model) {
  if (!model) return null;
  return model.clone(true);
}
