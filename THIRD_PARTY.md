# Third-party build inputs

Frida core devkit 17.23.3, Android arm64: official [release](https://github.com/frida/frida/releases/tag/17.23.3), [Frida core source and license](https://github.com/frida/frida-core), and [licensing information](https://frida.re/docs/faq/). The static core library is linked into the helper. Preserve applicable third-party notices when distributing a release.

Android SDK platform/build-tools and NDK r27c are acquired from Google's official repository metadata. Their own licenses/notices are included in the extracted inputs. No Android SDK/NDK files are included as source in this project; toolchains/vendor directories are ignored.

The original Pokemod APK and decoded agents are research artifacts elsewhere in the workspace. None are linked, imported or packaged in PGQL.
