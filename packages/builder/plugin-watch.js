import cc from "@ondohers/console-colors";

export default function watch() {
	return {
		name: 'watch-log',

		watchChange(id, type) {
			console.log(`${cc.set('fg_green', type.event)} of file ${id}`)
			return null;
		}
	};
}
