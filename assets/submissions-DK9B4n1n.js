import{x as d}from"./index-doLC5MR6.js";import{i as m,p as f}from"./questionIdentifier-o3odOoR-.js";async function w(r){const s=r.trim(),e=f(s);if(e.kind==="uuid")return e.id;if(e.kind!=="composite")throw new Error(`题目标识不合法：${s}（请使用 UUID，或使用如 junzhuan_2026_03_12_05 的格式）`);const t=Number.parseInt(e.exerciseNoRaw,10),i=[];Number.isFinite(t)&&i.push(t),i.push(e.exerciseNoRaw),Number.isFinite(t)&&i.push(String(t));for(const n of i){const{data:o,error:c}=await d.from("essay_questions").select("id").eq("date_tag",e.dateTag).eq("exercise_no",n).limit(2);if(c)throw c;if(!o||o.length===0)continue;if(o.length>1)throw new Error(`题目不唯一：date_tag=${e.dateTag} exercise_no=${String(n)}（请检查数据重复）`);const _=o[0];if(!_?.id)throw new Error(`题目解析失败：date_tag=${e.dateTag} exercise_no=${String(n)} 未返回 id`);const a=String(_.id);if(!m(a))throw new Error(`题目表 essay_questions.id 必须是 UUID（当前查到: ${a}）。请确认数据库 schema：essay_questions.id 为 uuid（默认 gen_random_uuid()），不要把类似 ${s} 这种业务编码写进 id 列。`);return a}throw new Error(`找不到题目：date_tag=${e.dateTag} exercise_no=${e.exerciseNoRaw}`)}async function h(r){try{const s="sk-L8SP2yWjvfscsThsuydvlinxnzLTwmkLquEEkeWsescNhTvn",e="https://llm.xiaochisaas.com",t=await y(r),i=await fetch(`${e}/v1/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s}`},body:JSON.stringify({model:"claude-sonnet-4-6",messages:[{role:"user",content:[{type:"text",text:`你是一名高精度中文手写文本识别助手。请识别图片中的全部手写文字，并忠实转写原文。

要求：
- 只做OCR转写，不做总结、翻译、润色、纠错。
- 保留原始段落、换行、序号、分点、标点。
- 保留原文中的错别字和不规范表达。
- 不确定的字词用【疑似：xxx】标记。
- 完全无法辨认的部分用【无法辨认】标记。
- 不要凭空补写。
- 如果图片中既有印刷体也有手写体，优先识别手写体正文。
- 输出必须是纯文本本身，不要附加解释。

请直接输出识别结果。`},{type:"image_url",image_url:{url:`data:image/jpeg;base64,${t}`}}]}],max_tokens:2e3,temperature:.1})});if(!i.ok){const c=await i.text();throw new Error(`LLM API 错误: ${c}`)}const o=(await i.json()).choices?.[0]?.message?.content?.trim();if(!o)throw new Error("未识别到文字");return{success:!0,text:o}}catch(s){return console.error("LLM OCR 错误:",s),{success:!1,error:s?.message||"OCR 识别失败"}}}async function y(r){return new Promise((s,e)=>{const t=new Image,i=new FileReader;i.onload=n=>{t.src=n.target?.result},t.onload=()=>{const n=document.createElement("canvas");let o=t.width,c=t.height;const _=2048;(o>_||c>_)&&(o>c?(c=c/o*_,o=_):(o=o/c*_,c=_)),n.width=o,n.height=c;const a=n.getContext("2d");if(!a){e(new Error("无法创建 canvas context"));return}a.drawImage(t,0,0,o,c);const l=g=>{const p=n.toDataURL("image/jpeg",g).split(",")[1]||null;return p&&p.length<4*1024*1024*.75?p:null};let u=l(.8)||l(.6)||l(.4)||l(.2);if(u||(n.width=o*.7,n.height=c*.7,a.drawImage(t,0,0,n.width,n.height),u=l(.5)||""),!u){e(new Error("图片压缩后仍超过大小限制"));return}s(u)},t.onerror=()=>e(new Error("图片加载失败")),i.onerror=()=>e(new Error("文件读取失败")),i.readAsDataURL(r)})}const E={async performLLMOCRFromFile(r){return h(r)},async createSubmission(r,s){const e=await w(r);if(!m(e))throw new Error(`question_id 必须是 UUID（解析后得到: ${e}）。这通常表示你把业务编码写进了 essay_questions.id，或 essay_questions.id 不是 uuid 类型。`);if(!m(s))throw new Error(`userId 必须是 UUID（收到: ${s}）`);const{data:t,error:i}=await d.from("essay_submissions").insert({question_id:e,user_id:s,ocr_status:"pending",grade_status:"pending",final_user_text:""}).select().single();if(i)throw i;return t},async createSubmissionWithOCR(r,s,e){const t=await w(r);if(!m(t))throw new Error(`question_id 必须是 UUID（解析后得到: ${t}）。这通常表示你把业务编码写进了 essay_questions.id，或 essay_questions.id 不是 uuid 类型。`);if(!m(s))throw new Error(`userId 必须是 UUID（收到: ${s}）`);const{data:i,error:n}=await d.from("essay_submissions").insert({question_id:t,user_id:s,ocr_status:"completed",grade_status:"pending",final_user_text:""}).select().single();if(n)throw n;return i},async uploadImage(r,s){const e=r.name.split(".").pop(),i=`submissions/${`${s}.${e}`}`,{error:n}=await d.storage.from("essay-images").upload(i,r,{upsert:!0});if(n)throw n;const{error:o}=await d.from("essay_submissions").update({image_path:i}).eq("id",s);if(o)throw o;return i},async updateOCRText(r,s,e){const{error:t}=await d.from("essay_submissions").update({ocr_status:e}).eq("id",r);if(t)throw t},async updateFinalText(r,s){const{error:e}=await d.from("essay_submissions").update({final_user_text:s}).eq("id",r);if(e)throw e},async getSubmissionById(r){const{data:s,error:e}=await d.from("essay_submissions").select(`
        *,
        question:essay_questions(*),
        grade:essay_grades(*)
      `).eq("id",r).single();if(e)throw e;return s},async getUserSubmissions(r){const{data:s,error:e}=await d.from("essay_submissions").select(`
        *,
        question:essay_questions(title, total_score),
        grade:essay_grades(total_score, overall_feedback)
      `).eq("user_id",r).order("created_at",{ascending:!1});if(e)throw e;return s},async requestGrading(r){try{const{data:s,error:e}=await d.functions.invoke("grade-essay",{body:{submissionId:r}});if(e)throw e;return s}catch(s){return console.warn("Edge Function failed, trying direct grading:",s),await this.performDirectGrading(r)}},async performDirectGrading(r){const{data:s,error:e}=await d.from("essay_submissions").select(`
        *,
        question:essay_questions(*)
      `).eq("id",r).single();if(e)throw e;if(!s.final_user_text)throw new Error("用户答案为空");await d.from("essay_submissions").update({grade_status:"processing"}).eq("id",r);const t=s.question,i=`你是一名资深公务员考试申论阅卷助手，请根据"题目要求、材料信息、参考答案、用户答案"对用户答案进行评分。

评分总原则：
1. 不要求用户逐字逐句照抄参考答案。
2. 评分时应优先判断"语义是否等价"，而不是"措辞是否一致"。
3. 只要用户答案与参考答案在核心观点、逻辑含义、关键事实、主要对策上基本一致，即可给分。
4. 允许近义表达、同义改写、概括表达、语序变化、拆分表达、合并表达、不同措辞。
5. 对不影响理解的少量错别字、轻微语病，应适度宽容，不应重扣。
6. 如果答案覆盖关键内容较全、逻辑清晰、表达通顺，应给予较高分。
7. 如果存在偏题、遗漏核心内容、逻辑混乱、空泛套话过多、与材料明显不符，则扣分。
8. 评分要兼顾：内容准确性、要点完整性、逻辑结构、语言表达。
9. 若用户答案明显过短、信息量严重不足、无法支撑完整作答，应据实低分，并明确指出原因。

评分任务要求：
1. 请先基于参考答案，自动提炼出若干"关键作答要点"。
2. 这些关键作答要点应尽量覆盖参考答案的核心信息。
3. 然后根据这些关键作答要点，判断用户答案命中了哪些内容、遗漏了哪些内容。
4. 不得因为用户没有照抄参考答案原句而机械扣分。
5. 若用户答案与参考答案表述不同，但语义等价，应判定为命中要点。
6. 若用户答案只命中了部分要点，可以给部分分数。
7. total_score 不得超过题目满分。
8. content_score、structure_score、expression_score 三项之和必须等于 total_score。
9. 所有评价必须具体、可解释、可用于指导修改。
10. 必须输出严格 JSON，不能输出 Markdown，不能输出额外解释文字。
11. 所有字段必须返回合法 JSON：
   - 数组为空时返回 []
   - 字符串为空时返回 ""
   - 不得返回 null
   - 不得返回 undefined

题目信息：
题目：${t.title}
题干：${t.question_text||""}
要求：${t.requirements||""}
字数限制：${t.word_limit??""}
满分：${t.total_score}

材料摘要：
${(t.material_text||"").substring(0,800)}

参考答案：
${t.standard_answer||t.answer_outline||""}

用户答案：
${s.final_user_text}

请严格按以下 JSON 格式输出：
{
  "total_score": 0,
  "content_score": 0,
  "structure_score": 0,
  "expression_score": 0,
  "derived_key_points": [
    {
      "point": "",
      "weight_hint": ""
    }
  ],
  "matched_points": [
    {
      "point": "",
      "reason": "",
      "score": 0
    }
  ],
  "missed_points": [
    {
      "point": "",
      "reason": ""
    }
  ],
  "deduction_points": [
    {
      "issue": "",
      "reason": "",
      "deduct_score": 0
    }
  ],
  "overall_feedback": "",
  "improvement_suggestions": [
    ""
  ]
}

额外注意：
- total_score 不能超过题目满分 ${t.total_score}
- content_score + structure_score + expression_score 必须严格等于 total_score
- 请先从参考答案中提炼关键作答要点，再进行评分
- derived_key_points 应尽量简洁、明确、避免重复
- matched_points / missed_points / deduction_points 必须尽量具体，不要空泛
- 如果用户答案与参考答案表述不同，但语义等价，必须给分
- 不要输出任何 JSON 之外的内容`,o=await fetch("https://llm.xiaochisaas.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer sk-L8SP2yWjvfscsThsuydvlinxnzLTwmkLquEEkeWsescNhTvn"},body:JSON.stringify({model:"claude-opus-4-6-thinking",messages:[{role:"user",content:i}],temperature:.3})});if(!o.ok){const u=await o.text();throw new Error(`LLM API 错误: ${u}`)}const c=await o.json(),_=c.choices[0].message.content;let a;try{let u=_.trim();u.startsWith("```json")?u=u.replace(/^```json\s*/,"").replace(/\s*```$/,""):u.startsWith("```")&&(u=u.replace(/^```\s*/,"").replace(/\s*```$/,"")),a=JSON.parse(u)}catch(u){throw console.error("JSON 解析失败:",u),console.error("原始输出:",_),new Error("AI 返回格式错误")}const{error:l}=await d.from("essay_grades").insert({submission_id:r,total_score:a.total_score,content_score:a.content_score,structure_score:a.structure_score,expression_score:a.expression_score,matched_points:a.matched_points,missed_points:a.missed_points,deduction_points:a.deduction_points,overall_feedback:a.overall_feedback,improvement_suggestions:a.improvement_suggestions,raw_model_output:c});if(l)throw l;return await d.from("essay_submissions").update({grade_status:"completed"}).eq("id",r),{success:!0,grade:a}}};export{E as s};
