// A small stand-in for @minecraft/server-ui 2.x, used only by the tests. Forms are recorded
// so a test can press a button the same way a player would. Only ActionFormData is used.

export const __mock = {
    forms: [],
};

export class ActionFormData {
    constructor() {
        this.titleText = '';
        this.bodyText = '';
        this.buttons = [];
    }

    title(text) {
        this.titleText = text;
        return this;
    }

    body(text) {
        this.bodyText = text;
        return this;
    }

    button(text, iconPath) {
        this.buttons.push({ text, iconPath });
        return this;
    }

    // Like the real API, this returns a promise that resolves when the player answers.
    show(player) {
        return new Promise((resolve) => {
            __mock.forms.push({ form: this, player, resolve, answered: false });
        });
    }
}
