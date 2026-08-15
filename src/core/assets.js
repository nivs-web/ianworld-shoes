/**
 * 에셋 로더. 모든 이미지는 여기를 거쳐 캐시된다.
 * 픽셀 에셋이므로 디코딩 후에도 스무딩이 붙지 않도록 항상 원본 크기로만 쓴다.
 */

/** @type {Map<string, HTMLImageElement>} */
const cache = new Map();

/**
 * @param {string} key 캐시 키
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(key, url) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      cache.set(key, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`에셋 로드 실패: ${url}`));
    img.src = url;
  });
}

/**
 * 여러 에셋을 병렬 로드하며 진행률을 알려준다.
 * @param {Array<{key:string,url:string}>} list
 * @param {(loaded:number,total:number)=>void} [onProgress]
 */
export async function loadAll(list, onProgress) {
  let loaded = 0;
  const total = list.length;
  onProgress?.(0, total);

  await Promise.all(
    list.map((it) =>
      loadImage(it.key, it.url).then(
        (img) => {
          loaded++;
          onProgress?.(loaded, total);
          return img;
        },
        (err) => {
          // 하나가 실패해도 나머지는 계속 로드한다. 화면에서 빈칸으로 드러난다.
          console.error(err);
          loaded++;
          onProgress?.(loaded, total);
          return null;
        }
      )
    )
  );
}

/** @returns {HTMLImageElement|null} */
export function img(key) {
  return cache.get(key) ?? null;
}

export function has(key) {
  return cache.has(key);
}

export function clearCache() {
  cache.clear();
}
