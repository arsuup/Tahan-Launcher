/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { ipcRenderer } = require('electron')

class Home {
    static id = "home";

    async init(config) {
        this.config = config;
        this.db = new database();
        this.news();
        this.instancesSelect();
        document.querySelector('.settings-btn').addEventListener('click', () => changePanel('settings'));
    }

    async news() {
        const newsElement = document.querySelector('.news-list');
        const news = await config.getNews(this.config).catch(() => null);
        const dateNow = this.getdate(new Date());

        // Cas : Erreur de chargement
        if (news === null) {
            this.renderNews(newsElement, "Erreur.", "Impossible de contacter le serveur des news.</br>Merci de vérifier votre configuration.", dateNow);
            return;
        }

        // Cas : Pas de news
        if (news.length === 0) {
            this.renderNews(newsElement, "Aucune news disponible.", "Vous pourrez suivre ici toutes les news relatives au serveur.", dateNow);
            return;
        }

        // Cas : Affichage des news
        newsElement.innerHTML = '';
        for (const item of news) {
            const date = this.getdate(item.publish_date);
            this.renderNews(newsElement, item.title, item.content.replace(/\n/g, '</br>'), date, item.author);
        }
    }

    renderNews(container, title, content, date, author = "Système") {
        const block = document.createElement('div');
        block.classList.add('news-block');
        block.innerHTML = `
            <div class="news-header">
                <img class="server-status-icon" src="assets/images/icon/icon.png">
                <div class="header-text"><div class="title">${title}</div></div>
                <div class="date">
                    <div class="day">${date.day}</div>
                    <div class="month">${date.month}</div>
                </div>
            </div>
            <div class="news-content">
                <div class="bbWrapper">
                    <p>${content}</p>
                    ${author !== "Système" ? `<p class="news-author">Auteur - <span>${author}</span></p>` : ''}
                </div>
            </div>`;
        container.appendChild(block);
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient');
        let cracked = configClient?.crack || false;
        const auth = await this.db.readData('accounts', configClient.account_selected);
        const instancesList = await config.getInstanceList();
        let authUuid;

        if (cracked){
            authUuid = await auth?.name || null;
        } else {
            authUuid = await auth?.uuid || null;
        }

        console.log(authUuid);
        
        let instanceBTN = document.querySelector('.play-instance');
        let instancePopup = document.querySelector('.instance-popup');
        let instancesListPopup = document.querySelector('.instances-List');
        let instanceCloseBTN = document.querySelector('.close-popup');
        let playBtnText = document.querySelector('.play-btn');

        if (instancesList.length <= 1) {
            document.querySelector('.instance-select').style.display = 'none';
            instanceBTN.style.paddingRight = '0';
            if (instancesList.length === 0) {
                playBtnText.textContent = "Indisponible";
                return;
            }
        }

        let currentInstance = instancesList.find(i => i.name === configClient.instance_select);
        
        if (!currentInstance || (currentInstance.whitelistActive && !currentInstance.whitelist.includes(authUuid))) {
            const available = instancesList.find(i => !i.whitelistActive || i.whitelist.includes(authUuid));
            
            if (available) {
                configClient.instance_select = available.name;
                await this.db.updateData('configClient', configClient);
                currentInstance = available;
            } else {
                playBtnText.textContent = "Non autorisé";
                return;
            }
        }

        setStatus(currentInstance.status);

        instancePopup.onclick = async (e) => {
            if (e.target.classList.contains('instance-elements')) {
                const newName = e.target.id;
                configClient.instance_select = newName;
                await this.db.updateData('configClient', configClient);
                
                document.querySelector('.active-instance')?.classList.remove('active-instance');
                e.target.classList.add('active-instance');
                
                const selected = instancesList.find(i => i.name === newName);
                setStatus(selected.status);
                instancePopup.style.display = 'none';
            }
        };

        instanceBTN.onclick = async (e) => {
            if (e.target.classList.contains('instance-select')) {
                instancesListPopup.innerHTML = '';
                instancesList.forEach(inst => {
                    const isAllowed = !inst.whitelistActive || inst.whitelist.includes(authUuid);
                    if (isAllowed) {
                        const activeClass = inst.name === configClient.instance_select ? 'active-instance' : '';
                        instancesListPopup.innerHTML += `<div id="${inst.name}" class="instance-elements ${activeClass}">${inst.name}</div>`;
                    }
                });
                instancePopup.style.display = 'flex';
            } else {
                this.startGame();
            }
        };

        instanceCloseBTN.onclick = () => instancePopup.style.display = 'none';
    }

    async startGame() {
        const launch = new Launch();
        const configClient = await this.db.readData('configClient');
        const instances = await config.getInstanceList();
        const authenticator = await this.db.readData('accounts', configClient.account_selected);
        const options = instances.find(i => i.name === configClient.instance_select);

        if (!options) return;

        const playInstanceBTN = document.querySelector('.play-instance');
        const infoStartingBOX = document.querySelector('.info-starting-game');
        const infoStarting = document.querySelector(".info-starting-game-text");
        const progressBar = document.querySelector('.progress-bar');

        const dataPath = `${await appdata()}/${process.platform === 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`;

        const opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: dataPath,
            instance: options.name,
            version: options.loader.minecraft_version,
            detached: configClient.launcher_config.closeLauncher !== "close-all",
            downloadFileMultiple: configClient.launcher_config.download_multi,
            loader: {
                type: options.loader.loader_type,
                build: options.loader.loader_version,
                enable: options.loader.loader_type !== 'none'
            },
            verify: options.verify,
            ignored: [...options.ignored],
            java: { path: configClient.java_config.java_path },
            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },
            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        };

        launch.Launch(opt);

        // UI States
        playInstanceBTN.style.display = "none";
        infoStartingBOX.style.display = "block";
        progressBar.style.display = "";
        ipcRenderer.send('main-window-progress-load');

        launch.on('progress', (progress, size) => {
            const percent = ((progress / size) * 100).toFixed(0);
            infoStarting.innerHTML = `Téléchargement ${percent}%`;
            ipcRenderer.send('main-window-progress', { progress, size });
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('check', (progress, size) => {
            const percent = ((progress / size) * 100).toFixed(0);
            infoStarting.innerHTML = `Vérification ${percent}%`;
            ipcRenderer.send('main-window-progress', { progress, size });
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('data', (e) => {
            progressBar.style.display = "none";
            if (configClient.launcher_config.closeLauncher === 'close-launcher') {
                ipcRenderer.send("main-window-hide");
            }
            infoStarting.innerHTML = `Démarrage en cours...`;
            new logger('Minecraft', '#36b030');
        });

        launch.on('close', () => {
            if (configClient.launcher_config.closeLauncher === 'close-launcher') {
                ipcRenderer.send("main-window-show");
            }
            this.resetUI(playInstanceBTN, infoStartingBOX);
        });

        launch.on('error', (err) => {
            new popup().openPopup({ title: 'Erreur', content: err.error, color: 'red', options: true });
            this.resetUI(playInstanceBTN, infoStartingBOX);
        });
    }

    resetUI(btn, box) {
        ipcRenderer.send('main-window-progress-reset');
        box.style.display = "none";
        btn.style.display = "flex";
        new logger(pkg.name, '#7289da');
    }

    getdate(e) {
        const date = new Date(e);
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return { 
            year: date.getFullYear(), 
            month: months[date.getMonth()], 
            day: date.getDate() 
        };
    }
}
export default Home;