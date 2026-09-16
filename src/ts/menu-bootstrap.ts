import { setupMenuReveal } from './features/menu-reveal';
import { query, queryAll } from './shared/dom';
import { configureMobileOverlapShadows, observeActiveMenuGroup } from './menu/observers';
import { observeBalancedMenuDescriptions } from './menu/typography';

const menuRoot = query<HTMLElement>('[data-menu-root]');
const menuGroups = query<HTMLElement>('[data-menu-groups]');

if (menuRoot && menuGroups) {
  const groups = queryAll<HTMLElement>('[data-menu-group]', menuGroups);

  if (groups.length) {
    setupMenuReveal(menuRoot, groups);
    observeBalancedMenuDescriptions(menuGroups);
    configureMobileOverlapShadows(groups);
    observeActiveMenuGroup(menuRoot, groups);
  }
}
