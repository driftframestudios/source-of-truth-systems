import { test, expect } from '@playwright/test';
import { renderedTextPairs } from './helpers/rendered-contrast.mjs';

test('cohort paint stays readable across appearances while the open draft stays attached', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Cohort Builder',exact:true}).click();
  await expect(page.locator('.plate-loading')).toHaveCount(0);
  const builder = page.locator('.cohort-builder');
  const group = builder.locator('[data-cohort-group]').nth(1);
  await group.getByRole('textbox',{name:'Group label',exact:true}).click();
  await group.getByRole('checkbox',{name:'Select group for linking',exact:true}).check();
  await group.getByRole('checkbox',{name:'Select Actionability tier card for linking',exact:true}).check();
  const groupId = await group.getAttribute('data-cohort-group');
  const name = page.getByRole('textbox',{name:'Rule name',exact:true});
  await name.fill('Paint retained');
  await page.getByRole('button',{name:'Save rule',exact:true}).click();
  for (const width of [1512,1024]) {
    await page.setViewportSize({width,height:982});
    for (const mode of ['Light','High contrast','Dark']) {
      await page.getByRole('radio',{name:mode,exact:true}).check();
      await expect(name).toHaveValue('Paint retained');
      await expect(group).toHaveAttribute('data-focused','true');
      await expect(group).toHaveAttribute('data-cohort-group',groupId);
      await expect(page.getByText('2 selected',{exact:true})).toBeVisible();
      const panes = width === 1024 ? ['Add cards','Rule & saved'] : [null];
      for (const pane of panes) {
        if(pane) await page.getByRole('button',{name:pane,exact:true}).click();
        if (pane !== 'Rule & saved') await page.getByTitle('Add Assay panel_solid to the focused group',{exact:true}).hover();
        if (mode !== 'Dark') {
          await expect.poll(async () => (await renderedTextPairs(builder)).filter(p=>p.ratio<4.5), {message:`${mode} ${width} rendered text pairs`}).toEqual([]);
        }
        await page.screenshot({path:`.visual-runs/cohort-${mode.replaceAll(' ','-')}-${width}-${pane === 'Add cards' ? 'facets':'rule'}.png`});
      }
      await expect(page.getByRole('button',{name:'Open rule Paint retained',exact:true})).toBeVisible();
    }
  }
  await page.getByRole('radio',{name:'Light',exact:true}).check();
  await group.dispatchEvent('dragover');
  await expect(group).toHaveAttribute('data-over','true');
  await expect.poll(async () => (await renderedTextPairs(group)).filter(p=>p.ratio<4.5)).toEqual([]);
  await group.dispatchEvent('dragleave');
});
