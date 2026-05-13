import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import { MemberSpaces } from '../components/member-spaces.component';
import { RecommendedSpaces } from '../components/recommended-spaces.component';

export class MySpaces extends BasePage {
  readonly memberSpaces: MemberSpaces;
  readonly recommendedSpaces: RecommendedSpaces;

  constructor(page: Page) {
    super(page);
    this.memberSpaces = new MemberSpaces(page);
    this.recommendedSpaces = new RecommendedSpaces(page);
  }

  async open() {
    await this.gotoApp('/my-spaces');
    await this.waitForPageLoad();
  }

  async testVisibility() {
    const memberSpacesVisible = await this.memberSpaces.isVisible();
    const recommendedSpacesVisible = await this.recommendedSpaces.isVisible();

    return {
      memberSpaces: memberSpacesVisible,
      recommendedSpaces: recommendedSpacesVisible,
    };
  }
}
