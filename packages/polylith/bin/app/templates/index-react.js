import { registry } from '@polylith/core';
import '@polylith/features';
import '@polylith/config';
import main from './main/main'

await registry.start();

main();
