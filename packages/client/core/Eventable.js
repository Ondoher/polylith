import { EventBus } from "./EventBus";

export function makeEventable(obj) {
	obj.eventBus = new EventBus('eventable:');

	obj.eventBus.implementOn(obj, 'fire');
	obj.eventBus.implementOn(obj, 'listen');
	obj.eventBus.implementOn(obj, 'unlisten');
}
