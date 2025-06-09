export interface Env {
  QUEUE: Queue<any>;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {

    // Some message to send
		const log = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
    };

    // Send the message
    await env.QUEUE.send(log);

    // return some response
    return new Response('Done!');
	},
} satisfies ExportedHandler<Env>;
