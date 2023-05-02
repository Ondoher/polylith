import { EventBus } from "./EventBus.js";

export function makeEventable(obj) {
	obj.eventBus = new EventBus('eventable:');

	obj.eventBus.implementOn(obj, 'fire');
	obj.eventBus.implementOn(obj, 'listen');
	obj.eventBus.implementOn(obj, 'unlisten');
}
