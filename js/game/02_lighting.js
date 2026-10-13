// ============================================================================
// 2b. STUDIO FLOODLIGHT RIG, SUN/RIM/SPOT LIGHTS & LIVE STUDIO SETTINGS API
// ============================================================================
(function () {
    'use strict';

    // Ensure window.hemiLight is exposed and tuned to Studio default
    if (typeof hemiLight !== 'undefined') {
        window.hemiLight = hemiLight;
        hemiLight.intensity = 0.65;
    }

    // Primary Stadium Sun / Floodlight Directional Key (dirLight)
    const dirLight = (typeof goalKeyLight !== 'undefined')
        ? goalKeyLight
        : new THREE.DirectionalLight(0xfff8eb, 1.35);
    dirLight.intensity = 1.35;
    dirLight.position.set(16, 34, 10);
    if (dirLight.target) {
        dirLight.target.position.set(0, 0.5, -14);
        if (!dirLight.target.parent && typeof scene !== 'undefined') {
            scene.add(dirLight.target);
        }
    }
    if (!dirLight.parent && typeof scene !== 'undefined') {
        scene.add(dirLight);
    }
    window.dirLight = dirLight;

    // Dramatic Stadium Back-Rim Light for Striker, Goalkeeper & Goal Frame Silhouettes
    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.55);
    rimLight.position.set(-14, 24, -36);
    rimLight.target.position.set(0, 1.2, -16);
    if (typeof scene !== 'undefined') {
        scene.add(rimLight);
        scene.add(rimLight.target);
    }
    window.rimLight = rimLight;

    // Focused Overhead Floodlight Spot on the Goal Mouth (Balanced to avoid turf glare)
    const goalSpotLight = new THREE.SpotLight(0xf8fafc, 0.48, 68, Math.PI / 3.4, 0.62, 1.35);
    goalSpotLight.position.set(0, 29, -14);
    goalSpotLight.target.position.set(0, 1.2, -19.8);
    goalSpotLight.castShadow = false;
    if (typeof scene !== 'undefined') {
        scene.add(goalSpotLight);
        scene.add(goalSpotLight.target);
    }
    window.goalSpotLight = goalSpotLight;

    // Default Studio Settings matching the 17 live sliders
    const DEFAULT_STUDIO_SETTINGS = {
        // Lighting
        exposure: 0.82,
        hemiIntensity: 0.65,
        sunIntensity: 1.35,
        sunElevation: 34,
        sunAzimuth: 16,
        rimIntensity: 0.55,
        fogDensity: 0.0032,
        // Textures & Materials
        grassRoughness: 0.92,
        grassBump: 0.030,
        hoardingBrightness: 0.88,
        netOpacity: 0.82,
        ballRoughness: 0.24,
        // Camera Angles
        camFov: 46,
        camDist: 3.6,
        camHeight: 1.52,
        camOffsetX: -0.18,
        camLookY: 1.32
    };

    window.studioSettings = Object.assign({}, DEFAULT_STUDIO_SETTINGS);
    window.__studioCameraTouched = false;

    // Apply initial lighting & fog defaults immediately
    if (typeof renderer !== 'undefined') {
        renderer.toneMappingExposure = window.studioSettings.exposure;
    }
    if (typeof scene !== 'undefined' && scene.fog) {
        scene.fog.density = window.studioSettings.fogDensity;
    }

    // Apply settings object to 3D scene lights, materials, and camera
    window.applyStudioSettings = function (input, markCameraTouched) {
        let parsed = input;
        if (typeof input === 'string') {
            try {
                parsed = JSON.parse(input);
            } catch (e) {
                console.warn('Invalid Studio JSON:', e);
                return window.studioSettings;
            }
        }
        if (!parsed || typeof parsed !== 'object') return window.studioSettings;

        const camKeys = ['camFov', 'camDist', 'camHeight', 'camOffsetX', 'camLookY'];
        camKeys.forEach(k => {
            if (parsed[k] !== undefined && Number(parsed[k]) !== DEFAULT_STUDIO_SETTINGS[k]) {
                window.__studioCameraTouched = true;
            }
        });
        if (markCameraTouched) {
            window.__studioCameraTouched = true;
        }

        Object.keys(DEFAULT_STUDIO_SETTINGS).forEach(key => {
            if (parsed[key] !== undefined && !isNaN(Number(parsed[key]))) {
                window.studioSettings[key] = Number(parsed[key]);
            }
        });

        const s = window.studioSettings;

        // 1. Lighting bindings
        if (typeof renderer !== 'undefined') {
            renderer.toneMappingExposure = s.exposure;
        }
        if (window.hemiLight) {
            window.hemiLight.intensity = s.hemiIntensity;
        }
        if (window.dirLight) {
            window.dirLight.intensity = s.sunIntensity;
            window.dirLight.position.set(s.sunAzimuth, s.sunElevation, 12);
        }
        if (window.rimLight) {
            window.rimLight.intensity = s.rimIntensity;
        }
        if (typeof scene !== 'undefined' && scene.fog) {
            scene.fog.density = s.fogDensity;
        }

        // 2. Textures & Materials bindings
        const pMat = window.pitchMat || (typeof pitchMat !== 'undefined' ? pitchMat : null);
        if (pMat) {
            window.pitchMat = pMat;
            pMat.roughness = s.grassRoughness;
            pMat.bumpScale = s.grassBump;
            if (pMat.normalScale && typeof pMat.normalScale.set === 'function') {
                const ns = Math.max(0.1, s.grassBump * 20.0);
                pMat.normalScale.set(ns, ns);
            }
            pMat.needsUpdate = true;
        }

        const hMat = window.adMat || (typeof adMat !== 'undefined' ? adMat : null);
        if (hMat) {
            window.adMat = hMat;
            if (hMat.color) {
                hMat.color.setScalar(s.hoardingBrightness);
            }
            if (hMat.emissiveIntensity !== undefined) {
                hMat.emissiveIntensity = s.hoardingBrightness * 0.45;
            }
            hMat.needsUpdate = true;
        }

        const nMat = window.netMat || (typeof netMat !== 'undefined' ? netMat : null);
        if (nMat) {
            window.netMat = nMat;
            nMat.opacity = s.netOpacity;
            nMat.needsUpdate = true;
        }
        if (window.netClothPhysics && window.netClothPhysics.netMaterial) {
            window.netClothPhysics.netMaterial.opacity = s.netOpacity;
        }

        const bMat = window.ballMat || (typeof ballMat !== 'undefined' ? ballMat : null);
        if (bMat) {
            window.ballMat = bMat;
            bMat.roughness = s.ballRoughness;
            bMat.needsUpdate = true;
        }

        // 3. Camera Angles bindings (when user adjusts Studio camera or when requested)
        if (typeof camera !== 'undefined' && (window.__studioCameraTouched || markCameraTouched) && !window.__overrideCamera) {
            camera.fov = s.camFov;
            camera.updateProjectionMatrix();
            const bx = (typeof ballMesh !== 'undefined' && ballMesh) ? ballMesh.position.x : (typeof spotX !== 'undefined' ? spotX : 0);
            const bz = (typeof ballMesh !== 'undefined' && ballMesh) ? ballMesh.position.z : (typeof spotZ !== 'undefined' ? spotZ : -9.0);
            if (typeof ballInFlight === 'undefined' || !ballInFlight) {
                camera.position.set(bx + s.camOffsetX, s.camHeight, bz + s.camDist);
                camera.lookAt(0, s.camLookY, -20.0);
            }
        }

        // Sync UI sliders if present in DOM
        Object.keys(DEFAULT_STUDIO_SETTINGS).forEach(key => {
            const slider = document.getElementById(`studio-slider-${key}`);
            const valSpan = document.getElementById(`studio-val-${key}`);
            if (slider && Number(slider.value) !== s[key]) {
                slider.value = s[key];
            }
            if (valSpan) {
                valSpan.innerText = formatStudioValue(key, s[key]);
            }
        });

        return s;
    };

    function formatStudioValue(key, val) {
        if (key === 'fogDensity') return Number(val).toFixed(4);
        if (key === 'grassBump') return Number(val).toFixed(3);
        if (key === 'sunElevation' || key === 'sunAzimuth' || key === 'camFov') return Math.round(Number(val)).toString();
        return Number(val).toFixed(2);
    }

    window.getStudioSettingsJSON = function () {
        return JSON.stringify(window.studioSettings, null, 2);
    };

    window.copyStudioSettingsToClipboard = function () {
        const json = window.getStudioSettingsJSON();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).catch(() => {});
        }
        const btn = document.getElementById('studio-copy-btn');
        if (btn) {
            const prev = btn.innerText;
            btn.innerText = '✅ COPIED JSON TO CLIPBOARD!';
            setTimeout(() => { btn.innerText = prev; }, 1600);
        }
        return json;
    };

    window.setWireframeMode = function (enabled) {
        const flag = !!enabled;
        window.__wireframeMode = flag;
        if (Array.isArray(window.characterAnimators)) {
            window.characterAnimators.forEach(a => {
                if (a && a.garmentUniforms && a.garmentUniforms.uWireframe) {
                    a.garmentUniforms.uWireframe.value = flag ? 1.0 : 0.0;
                }
            });
        }
        if (typeof scene !== 'undefined') {
            scene.traverse(obj => {
                if (obj.isMesh && obj.material) {
                    const isStaticProp = !obj.isSkinnedMesh && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position && obj.geometry.attributes.position.count > 600 && obj !== window.pitch;
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(m => {
                        if (m && 'wireframe' in m) {
                            m.wireframe = flag;
                            if (flag) {
                                if (m._savedRoughness === undefined) m._savedRoughness = m.roughness;
                                if (m._savedColorHex === undefined && m.color) m._savedColorHex = m.color.getHex();
                                m.roughness = 0.95;
                                if (isStaticProp && m.color) {
                                    m.color.setHex(0x0f172a);
                                }
                            } else {
                                if (m._savedRoughness !== undefined) m.roughness = m._savedRoughness;
                                if (m._savedColorHex !== undefined && m.color) m.color.setHex(m._savedColorHex);
                            }
                            m.needsUpdate = true;
                        }
                    });

                    // For high-density static glTF props like training_mannequin, attach a crisp topology edge helper in wireframe mode so bevels show clear wireframe lines
                    if (isStaticProp) {
                        if (flag) {
                            if (!obj._wfHelper) {
                                const edgeGeo = new THREE.EdgesGeometry(obj.geometry, 4);
                                const edgeMat = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95 });
                                obj._wfHelper = new THREE.LineSegments(edgeGeo, edgeMat);
                                obj.add(obj._wfHelper);
                            }
                            obj._wfHelper.visible = true;
                        } else if (obj._wfHelper) {
                            obj._wfHelper.visible = false;
                        }
                    }
                }
            });
        }
        const wfBtn = document.getElementById('studio-wireframe-btn');
        if (wfBtn) {
            wfBtn.classList.toggle('active', flag);
        }
        return flag;
    };

    window.setCleanViewportMode = function (enabled) {
        const flag = !!enabled;
        window.__cleanViewportMode = flag;
        if (document.body) {
            document.body.classList.toggle('clean-viewport', flag);
        }
        const cvBtn = document.getElementById('studio-clean-btn');
        if (cvBtn) {
            cvBtn.classList.toggle('active', flag);
        }
        return flag;
    };

    window.toggleStudioPanel = function (forceState) {
        const panel = document.getElementById('studio-panel');
        if (!panel) return;
        const shouldOpen = (typeof forceState === 'boolean') ? forceState : panel.classList.contains('collapsed');
        panel.classList.toggle('collapsed', !shouldOpen);
    };
})();
