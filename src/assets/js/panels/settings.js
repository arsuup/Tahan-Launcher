/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

import { changePanel, accountSelect, database, Slider, config, setStatus, popup, appdata, setBackground } from '../utils.js'
const { ipcRenderer } = require('electron');
const os = require('os');

class Settings {
    static id = "settings";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.navBTN()
        this.accounts()
        this.ram()
        this.javaPath()
        this.resolution()
        this.launcher()
    }

    navBTN() {
        document.querySelector('.nav-box').addEventListener('click', e => {
            if (e.target.classList.contains('nav-settings-btn')) {
                let id = e.target.id

                let activeSettingsBTN = document.querySelector('.active-settings-BTN')
                let activeContainerSettings = document.querySelector('.active-container-settings')

                if (id == 'save') {
                    if (activeSettingsBTN) activeSettingsBTN.classList.toggle('active-settings-BTN');
                    document.querySelector('#account').classList.add('active-settings-BTN');

                    if (activeContainerSettings) activeContainerSettings.classList.toggle('active-container-settings');
                    document.querySelector(`#account-tab`).classList.add('active-container-settings');
                    return changePanel('home')
                }

                if (activeSettingsBTN) activeSettingsBTN.classList.toggle('active-settings-BTN');
                e.target.classList.add('active-settings-BTN');

                if (activeContainerSettings) activeContainerSettings.classList.toggle('active-container-settings');
                document.querySelector(`#${id}-tab`).classList.add('active-container-settings');
            }
        })
    }

    accounts() {
        document.querySelector('.accounts-list').addEventListener('click', async e => {
            const accountCard = e.target.closest('.account');
            if (!accountCard) return;

            const id = accountCard.id;
            const popupAccount = new popup();

            try {
                if (id === 'add') {
                    document.querySelector('.cancel-home').style.display = 'inline';
                    return changePanel('login');
                }

                if (e.target.closest('.copy-id')) {
                    const val = e.target.closest('.copy-id').getAttribute('data-name');
                    if (val) await navigator.clipboard.writeText(val);
                    return;
                }

                let rawAccount = await this.db.readData('accounts', id);
                if (!rawAccount) rawAccount = await this.db.readData('accounts', parseInt(id));
                
                let account = Array.isArray(rawAccount) ? rawAccount[0] : rawAccount;
                if (!account) throw new Error("Compte non trouvé dans la DB");

                if (e.target.closest('.delete-profile')) {
                    popupAccount.openPopup({
                        title: 'Suppression',
                        content: 'Veuillez patienter...',
                        color: 'var(--color)'
                    });

                    await this.db.deleteData('accounts', id);
                    accountCard.remove();

                    let accountListElement = document.querySelector('.accounts-list');
                    if (accountListElement.children.length <= 1) return changePanel('login');

                    let configClient = await this.db.readData('configClient');
                    if (Array.isArray(configClient)) configClient = configClient[0];

                    if (configClient.account_selected == id) {
                        let allAccounts = await this.db.readAllData('accounts');
                        configClient.account_selected = allAccounts[0].ID;
                        await accountSelect(allAccounts[0]);
                        let newInstanceData = await this.setInstance(allAccounts[0]);
                        configClient.instance_select = newInstanceData.instance_select;
                        await this.db.updateData('configClient', configClient);
                    }
                    popupAccount.closePopup();
                    return;
                }

                popupAccount.openPopup({
                    title: 'Connexion',
                    content: 'Veuillez patienter...',
                    color: 'var(--color)'
                });

                let configClient = await this.setInstance(account);
                await accountSelect(account);

                if (configClient) {
                    configClient.account_selected = account.ID || account.id;
                    await this.db.updateData('configClient', configClient);
                }

                ipcRenderer.send('app-restart');
            } catch (err) {
                console.error("Erreur compte:", err);
            } finally {
                popupAccount.closePopup();
            }
        });
    }

    async setInstance(auth) {
        let configData = await this.db.readData('configClient');
        let configClient = Array.isArray(configData) ? configData[0] : configData;
        
        let instanceSelect = configClient.instance_select;
        let instancesList = await config.getInstanceList() || [];

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = (instance.whitelist || []).find(w => w == auth.name);
                if (whitelist !== auth.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
                        if (newInstanceSelect) {
                            configClient.instance_select = newInstanceSelect.name;
                            await setStatus(newInstanceSelect.status);
                        }
                    }
                }
            }
        }
        return configClient;
    }

    async ram() {
        let configData = await this.db.readData('configClient');
        let config = Array.isArray(configData) ? configData[0] : configData;

        let totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
        let freeMem = Math.trunc(os.freemem() / 1073741824 * 10) / 10;

        document.getElementById("total-ram").textContent = `${totalMem} Go`;
        document.getElementById("free-ram").textContent = `${freeMem} Go`;

        let sliderDiv = document.querySelector(".memory-slider");
        sliderDiv.setAttribute("max", Math.trunc((80 * totalMem) / 100));

        let ram = config?.java_config?.java_memory ? {
            ramMin: config.java_config.java_memory.min,
            ramMax: config.java_config.java_memory.max
        } : { ramMin: "1", ramMax: "2" };

        if (totalMem < ram.ramMin) {
            config.java_config.java_memory = { min: 1, max: 2 };
            this.db.updateData('configClient', config);
            ram = { ramMin: "1", ramMax: "2" }
        };

        let slider = new Slider(".memory-slider", parseFloat(ram.ramMin), parseFloat(ram.ramMax));

        let minSpan = document.querySelector(".slider-touch-left span");
        let maxSpan = document.querySelector(".slider-touch-right span");

        minSpan.setAttribute("value", `${ram.ramMin} Go`);
        maxSpan.setAttribute("value", `${ram.ramMax} Go`);

        slider.on("change", async (min, max) => {
            let cData = await this.db.readData('configClient');
            let c = Array.isArray(cData) ? cData[0] : cData;
            minSpan.setAttribute("value", `${min} Go`);
            maxSpan.setAttribute("value", `${max} Go`);
            c.java_config.java_memory = { min: min, max: max };
            this.db.updateData('configClient', c);
        });
    }

    async javaPath() {
        let javaPathText = document.querySelector(".java-path-txt")
        javaPathText.textContent = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/runtime`;

        let configData = await this.db.readData('configClient')
        let configClient = Array.isArray(configData) ? configData[0] : configData;

        let javaPath = configClient?.java_config?.java_path || 'Utiliser la version de java livre avec le launcher';
        let javaPathInputTxt = document.querySelector(".java-path-input-text");
        let javaPathInputFile = document.querySelector(".java-path-input-file");
        javaPathInputTxt.value = javaPath;

        document.querySelector(".java-path-set").addEventListener("click", async () => {
            javaPathInputFile.value = '';
            javaPathInputFile.click();
            await new Promise((resolve) => {
                let interval;
                interval = setInterval(() => {
                    if (javaPathInputFile.value != '') resolve(clearInterval(interval));
                }, 100);
            });

            if (javaPathInputFile.value.replace(".exe", '').endsWith("java") || javaPathInputFile.value.replace(".exe", '').endsWith("javaw")) {
                let cData = await this.db.readData('configClient')
                let c = Array.isArray(cData) ? cData[0] : cData;
                let file = javaPathInputFile.files[0].path;
                javaPathInputTxt.value = file;
                c.java_config.java_path = file
                await this.db.updateData('configClient', c);
            } else alert("Le nom du fichier doit être java ou javaw");
        });

        document.querySelector(".java-path-reset").addEventListener("click", async () => {
            let cData = await this.db.readData('configClient')
            let c = Array.isArray(cData) ? cData[0] : cData;
            javaPathInputTxt.value = 'Utiliser la version de java livre avec le launcher';
            c.java_config.java_path = null
            await this.db.updateData('configClient', c);
        });
    }

    async resolution() {
        let configData = await this.db.readData('configClient')
        let configClient = Array.isArray(configData) ? configData[0] : configData;

        let resolution = configClient?.game_config?.screen_size || { width: 1920, height: 1080 };

        let width = document.querySelector(".width-size");
        let height = document.querySelector(".height-size");
        let resolutionReset = document.querySelector(".size-reset");

        width.value = resolution.width;
        height.value = resolution.height;

        width.addEventListener("change", async () => {
            let cData = await this.db.readData('configClient')
            let c = Array.isArray(cData) ? cData[0] : cData;
            c.game_config.screen_size.width = width.value;
            await this.db.updateData('configClient', c);
        })

        height.addEventListener("change", async () => {
            let cData = await this.db.readData('configClient')
            let c = Array.isArray(cData) ? cData[0] : cData;
            c.game_config.screen_size.height = height.value;
            await this.db.updateData('configClient', c);
        })

        resolutionReset.addEventListener("click", async () => {
            let cData = await this.db.readData('configClient')
            let c = Array.isArray(cData) ? cData[0] : cData;
            c.game_config.screen_size = { width: '854', height: '480' };
            width.value = '854';
            height.value = '480';
            await this.db.updateData('configClient', c);
        })
    }

    async launcher() {
        let configData = await this.db.readData('configClient');
        let configClient = Array.isArray(configData) ? configData[0] : configData;

        let maxDownloadFiles = configClient?.launcher_config?.download_multi || 5;
        let maxDownloadFilesInput = document.querySelector(".max-files");
        let maxDownloadFilesReset = document.querySelector(".max-files-reset");
        maxDownloadFilesInput.value = maxDownloadFiles;

        maxDownloadFilesInput.addEventListener("change", async () => {
            let cData = await this.db.readData('configClient')
            let c = Array.isArray(cData) ? cData[0] : cData;
            c.launcher_config.download_multi = maxDownloadFilesInput.value;
            await this.db.updateData('configClient', c);
        })

        maxDownloadFilesReset.addEventListener("click", async () => {
            let cData = await this.db.readData('configClient')
            let c = Array.isArray(cData) ? cData[0] : cData;
            maxDownloadFilesInput.value = 5
            c.launcher_config.download_multi = 5;
            await this.db.updateData('configClient', c);
        })

        let themeBox = document.querySelector(".theme-box");
        let theme = configClient?.launcher_config?.theme || "auto";

        if (theme == "auto") {
            document.querySelector('.theme-btn-auto').classList.add('active-theme');
        } else if (theme == "dark") {
            document.querySelector('.theme-btn-sombre').classList.add('active-theme');
        } else if (theme == "light") {
            document.querySelector('.theme-btn-clair').classList.add('active-theme');
        }

        themeBox.addEventListener("click", async e => {
            if (e.target.classList.contains('theme-btn')) {
                let activeTheme = document.querySelector('.active-theme');
                if (e.target.classList.contains('active-theme')) return
                activeTheme?.classList.remove('active-theme');

                if (e.target.classList.contains('theme-btn-auto')) {
                    setBackground();
                    theme = "auto";
                    e.target.classList.add('active-theme');
                } else if (e.target.classList.contains('theme-btn-sombre')) {
                    setBackground(true);
                    theme = "dark";
                    e.target.classList.add('active-theme');
                } else if (e.target.classList.contains('theme-btn-clair')) {
                    setBackground(false);
                    theme = "light";
                    e.target.classList.add('active-theme');
                }

                let cData = await this.db.readData('configClient')
                let c = Array.isArray(cData) ? cData[0] : cData;
                c.launcher_config.theme = theme;
                await this.db.updateData('configClient', c);
            }
        })

        let closeBox = document.querySelector(".close-box");
        let closeLauncher = configClient?.launcher_config?.closeLauncher || "close-launcher";

        if (closeLauncher == "close-launcher") {
            document.querySelector('.close-launcher').classList.add('active-close');
        } else if (closeLauncher == "close-all") {
            document.querySelector('.close-all').classList.add('active-close');
        } else if (closeLauncher == "close-none") {
            document.querySelector('.close-none').classList.add('active-close');
        }

        closeBox.addEventListener("click", async e => {
            if (e.target.classList.contains('close-btn')) {
                let activeClose = document.querySelector('.active-close');
                if (e.target.classList.contains('active-close')) return
                activeClose?.classList.toggle('active-close');

                let cData = await this.db.readData('configClient')
                let c = Array.isArray(cData) ? cData[0] : cData;

                if (e.target.classList.contains('close-launcher')) {
                    e.target.classList.toggle('active-close');
                    c.launcher_config.closeLauncher = "close-launcher";
                    await this.db.updateData('configClient', c);
                } else if (e.target.classList.contains('close-all')) {
                    e.target.classList.toggle('active-close');
                    c.launcher_config.closeLauncher = "close-all";
                    await this.db.updateData('configClient', c);
                } else if (e.target.classList.contains('close-none')) {
                    e.target.classList.toggle('active-close');
                    c.launcher_config.closeLauncher = "close-none";
                    await this.db.updateData('configClient', c);
                }
            }
        })
    }
}
export default Settings;