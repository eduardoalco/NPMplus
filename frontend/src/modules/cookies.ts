export async function deleteCookie(name: string) {
	if ("cookieStore" in window) {
		await window.cookieStore.delete(name);
		return;
	}

	// biome-ignore lint/suspicious/noDocumentCookie: fallback for browsers without the Cookie Store API.
	document.cookie = `${name}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
}
