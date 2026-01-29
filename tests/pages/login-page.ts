import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('https://driverevel.com/login');
  }

  async fillPhone(phone: string) {
    const phoneInput = this.page.locator('xpath=/html/body/div[3]/div/div/div/div[2]/div[1]/form/div[1]/div[1]/div/div[2]/input');
    await phoneInput.fill(phone);
  }
}
