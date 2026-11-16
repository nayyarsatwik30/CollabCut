import * as THREE from 'three'

// Image-based lighting without an image: a small studio of emissive panels
// (softboxes, strips, a rim light) is rendered once into a prefiltered
// environment map. Nothing is downloaded. Panel values above 1 are HDR, which
// is what gives the polished spheres their crisp highlights.
export function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const studio = new THREE.Scene()
  const disposables: { dispose: () => void }[] = []

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(30, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vDir; void main(){ float h = smoothstep(-0.5, 1.0, vDir.y); gl_FragColor = vec4(vec3(mix(0.07, 0.3, h)), 1.0); }',
    }),
  )
  studio.add(dome)
  disposables.push(dome.geometry, dome.material as THREE.Material)

  const panel = (w: number, h: number, x: number, y: number, z: number, intensity: number) => {
    const geometry = new THREE.PlaneGeometry(w, h)
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide, toneMapped: false })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.lookAt(0, 0, 0)
    studio.add(mesh)
    disposables.push(geometry, material)
  }
  panel(11, 6.5, -8, 10, 7, 7.5) // key softbox, upper left front
  panel(2.2, 13, 12, 2, 4, 4.5) // tall strip, right
  panel(9, 1.3, -10, -6, 3, 2.2) // low kicker, left
  panel(16, 2.2, 0, 7, -13, 3.5) // rim, behind and above
  panel(3, 3, 7, -8, 8, 1.6) // small window, lower right front
  panel(14, 9, 0, 1, 16, 0.4) // broad soft fill from the camera side

  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(studio, 0.03)
  pmrem.dispose()
  disposables.forEach((d) => d.dispose())
  return target
}
