(()=>{var t={};t.id=8746,t.ids=[8746],t.modules={10846:t=>{"use strict";t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:t=>{"use strict";t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},29294:t=>{"use strict";t.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:t=>{"use strict";t.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},18311:(t,e,r)=>{"use strict";r.r(e),r.d(e,{patchFetch:()=>x,routeModule:()=>u,serverHooks:()=>m,workAsyncStorage:()=>c,workUnitAsyncStorage:()=>g});var o={};r.r(o),r.d(o,{POST:()=>l});var s=r(42706),a=r(28203),i=r(45994),p=r(39187),n=r(65658);let d=n.Ik({name:n.Yj().min(2,"Nome obrigat\xf3rio"),email:n.Yj().email("Email inv\xe1lido"),company:n.Yj().optional(),subject:n.k5(["proposta","suporte","parceria","outro"]),message:n.Yj().min(20,"Mensagem muito curta")});async function l(t){try{let e=await t.json(),r=d.safeParse(e);if(!r.success)return p.NextResponse.json({error:"Dados inv\xe1lidos",issues:r.error.issues},{status:400});let{name:o,email:s,company:a,subject:i,message:n}=r.data,l=process.env.RESEND_API_KEY;if(l){let t={proposta:"Pedir proposta",suporte:"Suporte t\xe9cnico",parceria:"Parceria",outro:"Outro"},e=`
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #07111F; border-bottom: 2px solid #4DA3FF; padding-bottom: 12px;">
            Nova mensagem via yourgift.pt
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px; width: 120px;">Nome</td>
              <td style="padding: 8px 0; font-weight: 600;">${o}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; font-weight: 600;">
                <a href="mailto:${s}" style="color: #4DA3FF;">${s}</a>
              </td>
            </tr>
            ${a?`<tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Empresa</td>
              <td style="padding: 8px 0; font-weight: 600;">${a}</td>
            </tr>`:""}
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Assunto</td>
              <td style="padding: 8px 0; font-weight: 600;">${t[i]??i}</td>
            </tr>
          </table>
          <div style="background: #f5f7fa; border-radius: 8px; padding: 16px; margin-top: 12px;">
            <p style="font-size: 14px; color: #666; margin: 0 0 8px;">Mensagem:</p>
            <p style="white-space: pre-wrap; margin: 0; line-height: 1.6;">${n}</p>
          </div>
          <p style="font-size: 12px; color: #999; margin-top: 24px;">
            Enviado via yourgift.pt \xb7 ${new Date().toLocaleString("pt-PT")}
          </p>
        </div>
      `;await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${l}`,"Content-Type":"application/json"},body:JSON.stringify({from:"yourgift.pt <noreply@yourgift.pt>",to:["hello@yourgift.pt"],reply_to:s,subject:`[yourgift.pt] ${t[i]??i} — ${o}`,html:e})})}return l||console.log("[contact] New message:",{name:o,email:s,company:a,subject:i}),p.NextResponse.json({success:!0,message:"Mensagem recebida. Respondemos em 24h \xfateis."},{status:201})}catch{return p.NextResponse.json({error:"Erro interno. Tenta novamente ou contacta hello@yourgift.pt."},{status:500})}}let u=new s.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/contact/route",pathname:"/api/contact",filename:"route",bundlePath:"app/api/contact/route"},resolvedPagePath:"C:\\Users\\Carlos\\Desktop\\CODE & OZ\\yourgift\\app\\api\\contact\\route.ts",nextConfigOutput:"",userland:o}),{workAsyncStorage:c,workUnitAsyncStorage:g,serverHooks:m}=u;function x(){return(0,i.patchFetch)({workAsyncStorage:c,workUnitAsyncStorage:g})}},96487:()=>{},78335:()=>{}};var e=require("../../../webpack-runtime.js");e.C(t);var r=t=>e(e.s=t),o=e.X(0,[2680,8413],()=>r(18311));module.exports=o})();