import{d}from"./index-Rp-Jda7w.js";import{$ as m,m as p}from"./questionIdentifier-o3odOoR--4rtLlp1v-BowAQniN.js";async function h(r){const t=r.trim(),e=p(t);if(e.kind==="uuid")return e.id;if(e.kind!=="composite")throw new Error(`题目标识不合法：${t}（请使用 UUID，或使用如 junzhuan_2026_03_12_05 的格式）`);const s=Number.parseInt(e.exerciseNoRaw,10),i=[];Number.isFinite(s)&&i.push(s),i.push(e.exerciseNoRaw),Number.isFinite(s)&&i.push(String(s));for(const o of i){const{data:a,error:u}=await d.from("essay_questions").select("id").eq("date_tag",e.dateTag).eq("exercise_no",o).limit(2);if(u)throw u;if(!a||a.length===0)continue;if(a.length>1)throw new Error(`题目不唯一：date_tag=${e.dateTag} exercise_no=${String(o)}（请检查数据重复）`);const n=a[0];if(!n?.id)throw new Error(`题目解析失败：date_tag=${e.dateTag} exercise_no=${String(o)} 未返回 id`);const _=String(n.id);if(!m(_))throw new Error(`题目表 essay_questions.id 必须是 UUID（当前查到: ${_}）。请确认数据库 schema：essay_questions.id 为 uuid（默认 gen_random_uuid()），不要把类似 ${t} 这种业务编码写进 id 列。`);return _}throw new Error(`找不到题目：date_tag=${e.dateTag} exercise_no=${e.exerciseNoRaw}`)}async function f(r){try{const t="sk-L8SP2yWjvfscsThsuydvlinxnzLTwmkLquEEkeWsescNhTvn",e="https://llm.xiaochisaas.com",s=await y(r),i=await fetch(`${e}/v1/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({model:"claude-sonnet-4-6",messages:[{role:"user",content:[{type:"text",text:`你是一名高精度中文手写文本识别助手。请识别图片中的全部手写文字，并忠实转写原文。

要求：
- 只做OCR转写，不做总结、翻译、润色、纠错。
- 保留原始段落、换行、序号、分点、标点。
- 保留原文中的错别字和不规范表达。
- 不确定的字词用【疑似：xxx】标记。
- 完全无法辨认的部分用【无法辨认】标记。
- 不要凭空补写。
- 如果图片中既有印刷体也有手写体，优先识别手写体正文。
- 输出必须是纯文本本身，不要附加解释。

请直接输出识别结果。`},{type:"image_url",image_url:{url:`data:image/jpeg;base64,${s}`}}]}],max_tokens:2e3,temperature:.1})});if(!i.ok){const a=await i.text();throw new Error(`LLM API 错误: ${a}`)}const o=(await i.json()).choices?.[0]?.message?.content?.trim();if(!o)throw new Error("未识别到文字");return{success:!0,text:o}}catch(t){return console.error("LLM OCR 错误:",t),{success:!1,error:t?.message||"OCR 识别失败"}}}async function y(r){return new Promise((t,e)=>{const s=new Image,i=new FileReader;i.onload=o=>{s.src=o.target?.result},s.onload=()=>{const o=document.createElement("canvas");let a=s.width,u=s.height;const n=2048;(a>n||u>n)&&(a>u?(u=u/a*n,a=n):(a=a/u*n,u=n)),o.width=a,o.height=u;const _=o.getContext("2d");if(!_){e(new Error("无法创建 canvas context"));return}_.drawImage(s,0,0,a,u);const c=g=>{const w=o.toDataURL("image/jpeg",g).split(",")[1]||null;return w&&w.length<4*1024*1024*.75?w:null};let l=c(.8)||c(.6)||c(.4)||c(.2);if(l||(o.width=a*.7,o.height=u*.7,_.drawImage(s,0,0,o.width,o.height),l=c(.5)||""),!l){e(new Error("图片压缩后仍超过大小限制"));return}t(l)},s.onerror=()=>e(new Error("图片加载失败")),i.onerror=()=>e(new Error("文件读取失败")),i.readAsDataURL(r)})}const q={async performLLMOCRFromFile(r){return f(r)},async createSubmission(r,t){const e=await h(r);if(!m(e))throw new Error(`question_id 必须是 UUID（解析后得到: ${e}）。这通常表示你把业务编码写进了 essay_questions.id，或 essay_questions.id 不是 uuid 类型。`);if(!m(t))throw new Error(`userId 必须是 UUID（收到: ${t}）`);const{data:s,error:i}=await d.from("essay_submissions").insert({question_id:e,user_id:t,ocr_status:"pending",grade_status:"pending",final_user_text:""}).select().single();if(i)throw i;return s},async createSubmissionWithOCR(r,t,e){const s=await h(r);if(!m(s))throw new Error(`question_id 必须是 UUID（解析后得到: ${s}）。这通常表示你把业务编码写进了 essay_questions.id，或 essay_questions.id 不是 uuid 类型。`);if(!m(t))throw new Error(`userId 必须是 UUID（收到: ${t}）`);const{data:i,error:o}=await d.from("essay_submissions").insert({question_id:s,user_id:t,ocr_status:"completed",grade_status:"pending",final_user_text:""}).select().single();if(o)throw o;return i},async uploadImage(r,t){const e=r.name.split(".").pop(),s=`submissions/${`${t}.${e}`}`,{error:i}=await d.storage.from("essay-images").upload(s,r,{upsert:!0});if(i)throw i;const{error:o}=await d.from("essay_submissions").update({image_path:s}).eq("id",t);if(o)throw o;return s},async updateOCRText(r,t,e){const{error:s}=await d.from("essay_submissions").update({ocr_status:e}).eq("id",r);if(s)throw s},async updateFinalText(r,t){const{error:e}=await d.from("essay_submissions").update({final_user_text:t}).eq("id",r);if(e)throw e},async getSubmissionById(r){const{data:t,error:e}=await d.from("essay_submissions").select(`
        *,
        question:essay_questions(*),
        grade:essay_grades(*)
      `).eq("id",r).single();if(e)throw e;return t},async getUserSubmissions(r){const{data:t,error:e}=await d.from("essay_submissions").select(`
        *,
        question:essay_questions(title, total_score),
        grade:essay_grades(total_score, overall_feedback)
      `).eq("user_id",r).order("created_at",{ascending:!1});if(e)throw e;return t},async requestGrading(r){try{const{data:t,error:e}=await d.functions.invoke("grade-essay",{body:{submissionId:r}});if(e)throw e;return t}catch(t){return console.warn("Edge Function failed, trying direct grading:",t),await this.performDirectGrading(r)}},async performDirectGrading(r){const{data:t,error:e}=await d.from("essay_submissions").select(`
        *,
        question:essay_questions(*)
      `).eq("id",r).single();if(e)throw e;if(!t.final_user_text)throw new Error("用户答案为空");await d.from("essay_submissions").update({grade_status:"processing"}).eq("id",r);const s=t.question,i=`你是一名资深公务员考试申论阅卷助手，请根据"题目要求、材料信息、参考答案、用户答案"对用户答案进行评分。

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
题目：${s.title}
题干：${s.question_text||""}
要求：${s.requirements||""}
字数限制：${s.word_limit??""}
满分：${s.total_score}

材料摘要：
${(s.material_text||"").substring(0,800)}

参考答案：
${s.standard_answer||s.answer_outline||""}

用户答案：
${t.final_user_text}

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
- total_score 不能超过题目满分 ${s.total_score}
- content_score + structure_score + expression_score 必须严格等于 total_score
- 请先从参考答案中提炼关键作答要点，再进行评分
- derived_key_points 应尽量简洁、明确、避免重复
- matched_points / missed_points / deduction_points 必须尽量具体，不要空泛
- 如果用户答案与参考答案表述不同，但语义等价，必须给分
- 不要输出任何 JSON 之外的内容`,o=await fetch("https://llm.xiaochisaas.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer sk-L8SP2yWjvfscsThsuydvlinxnzLTwmkLquEEkeWsescNhTvn"},body:JSON.stringify({model:"claude-opus-4-6-thinking",messages:[{role:"user",content:i}],temperature:.3})});if(!o.ok){const c=await o.text();throw new Error(`LLM API 错误: ${c}`)}const a=await o.json(),u=a.choices[0].message.content;let n;try{let c=u.trim();c.startsWith("```json")?c=c.replace(/^```json\s*/,"").replace(/\s*```$/,""):c.startsWith("```")&&(c=c.replace(/^```\s*/,"").replace(/\s*```$/,"")),n=JSON.parse(c)}catch(c){throw console.error("JSON 解析失败:",c),console.error("原始输出:",u),new Error("AI 返回格式错误")}const{error:_}=await d.from("essay_grades").insert({submission_id:r,total_score:n.total_score,content_score:n.content_score,structure_score:n.structure_score,expression_score:n.expression_score,matched_points:n.matched_points,missed_points:n.missed_points,deduction_points:n.deduction_points,overall_feedback:n.overall_feedback,improvement_suggestions:n.improvement_suggestions,raw_model_output:a});if(_)throw _;return await d.from("essay_submissions").update({grade_status:"completed"}).eq("id",r),{success:!0,grade:n}}};export{q as $};
