import handler from 'vinext/server/app-router-entry';
import { runDailyJobs } from './app/lib/daily';

type Bindings={DB:D1Database;FILES:R2Bucket};

export default {
  fetch(request:Request,env:Bindings,context:ExecutionContext){return handler.fetch(request,env as unknown as Parameters<typeof handler.fetch>[1],context)},
  scheduled(controller:ScheduledController,env:Bindings,context:ExecutionContext){context.waitUntil(runDailyJobs(env,new Date(controller.scheduledTime)))},
} satisfies ExportedHandler<Bindings>;
