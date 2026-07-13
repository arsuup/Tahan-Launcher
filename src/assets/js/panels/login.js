/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
const { Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';

class Login {
    static id = "login";

    constructor() {
        this.popupLogin = new popup();
    }

    // Le premier qui fait une remarque par rapport à mon code douteux, bah il a raison

    async init(config) {
        this.config = config;
        this.db = new database();

        this.loginHome = document.querySelector('.login-home');
        this.loginOffline = document.querySelector('.login-offline');
        this.emailInput = document.querySelector('.email-offline');

        this.getLoginHome()
    }

    handleMicrosoftBTNClick = () => {
        this.popupLogin.openPopup({
            title: 'Connexion',
            content: 'Veuillez patienter...',
            color: 'var(--color)'
        });

        ipcRenderer.invoke('Microsoft-window', this.config.client_id).then(async account_connect => {
            if (account_connect == 'cancel' || !account_connect) {
                popupLogin.closePopup();
            } else {
                await this.saveData(account_connect)
                popupLogin.closePopup();
            }

        });
    };

    handleCancelHomeBtn = () => {
        return changePanel('settings')
    };

    async getLoginHome() {
        this.loginHome.style.display = 'block';
        const microsoftBtn = document.querySelector('.connect-home');
        const crackBtn = document.querySelector('.connect-crack');
        const cancelHomeBtn = document.querySelector('.cancel-home');

        crackBtn.removeEventListener('click', this.handleCrackClick);
        crackBtn.addEventListener('click', this.handleCrackClick);

        microsoftBtn.removeEventListener("click", this.handleMicrosoftBTNClick);
        microsoftBtn.addEventListener("click", this.handleMicrosoftBTNClick);

        cancelHomeBtn.removeEventListener("click", this.handleCancelHomeBtn);
        cancelHomeBtn.addEventListener("click", this.handleCancelHomeBtn);
    }

    handleCrackClick = () => {
        this.getCrack();
        document.querySelector('.login-home').style.display = 'none';
    };

    handleConnectOfflineClick = async () => {
        const username = this.emailInput.value;

        if (username.length < 3) {
            this.popupLogin.openPopup({
                title: 'Erreur',
                content: 'Votre pseudo doit faire au moins 3 caractères.',
                options: true
            });
            return;
        }

        if (username.includes(' ')) {
            this.popupLogin.openPopup({
                title: 'Erreur',
                content: 'Votre pseudo ne doit pas contenir d\'espaces.',
                options: true
            });
            return;
        }

        let MojangConnect = await Mojang.login(username);

        if (MojangConnect.error) {
            this.popupLogin.openPopup({
                title: 'Erreur',
                content: MojangConnect.message,
                options: true
            });
            return;
        }
        await this.saveData(MojangConnect);
        this.getLoginHome();
        this.loginOffline.style.display = 'none';
        return changePanel('settings');
        //this.popupLogin.closePopup();
    };

    handleCancelOfflineClick = () => {
        this.getLoginHome();
        this.loginOffline.style.display = 'none';
    };

    async getCrack() {
        this.loginOffline.style.display = 'block';
        const connectOffline = document.querySelector('.connect-offline');
        const cancelOffline = document.querySelector('.cancel-offline')

        connectOffline.removeEventListener('click', this.handleConnectOfflineClick);
        connectOffline.addEventListener('click', this.handleConnectOfflineClick);

        cancelOffline.removeEventListener('click', this.handleCancelOfflineClick);
        cancelOffline.addEventListener('click', this.handleCancelOfflineClick);
    }

    async saveData(connectionData) {
        let configClient = await this.db.readData('configClient');
        let account = await this.db.createData('accounts', connectionData)
        let instanceSelect = configClient.instance_select
        let instancesList = await config.getInstanceList()
        configClient.account_selected = account.ID;

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == account.name)
                if (whitelist !== account.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        configClient.instance_select = newInstanceSelect.name
                        await setStatus(newInstanceSelect.status)
                    }
                }
            }
        }

        await this.db.updateData('configClient', configClient);
        await addAccount(account);
        await accountSelect(account);
        changePanel('home');
    }
}
export default Login;