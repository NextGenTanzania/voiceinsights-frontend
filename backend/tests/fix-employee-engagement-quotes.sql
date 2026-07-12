-- Fixes a real content-coherence issue discovered during Phase 10 narrative
-- authoring: employee_engagement shared the private_sector quote pool with
-- customer-facing surveys (Market Research, Customer Satisfaction), so its
-- demo respondents were shown saying things like "I would recommend this
-- service to others" and "customer service has improved" -- which makes no
-- sense as INTERNAL STAFF feedback. Replacing with genuine, distinct
-- employee-engagement-appropriate quotes for the same 15 answer/transcript
-- rows the report actually displays (representative_quotes is capped at 12
-- in report-generator.js, so only these rows are ever shown).

UPDATE answers SET answer_text = 'Management has been more transparent about company decisions this quarter.' WHERE id = 'demo_answer_employee_engagement_0';
UPDATE transcripts SET raw_text = 'Management has been more transparent about company decisions this quarter.' WHERE answer_id = 'demo_answer_employee_engagement_0';

UPDATE answers SET answer_text = 'There are still limited opportunities for career growth in my department.' WHERE id = 'demo_answer_employee_engagement_1';
UPDATE transcripts SET raw_text = 'There are still limited opportunities for career growth in my department.' WHERE answer_id = 'demo_answer_employee_engagement_1';

UPDATE answers SET answer_text = 'My workload has increased but staffing has not kept pace.' WHERE id = 'demo_answer_employee_engagement_2';
UPDATE transcripts SET raw_text = 'My workload has increased but staffing has not kept pace.' WHERE answer_id = 'demo_answer_employee_engagement_2';

UPDATE answers SET answer_text = 'Management has been more transparent about company decisions this quarter.' WHERE id = 'demo_answer_employee_engagement_3';
UPDATE transcripts SET raw_text = 'Management has been more transparent about company decisions this quarter.' WHERE answer_id = 'demo_answer_employee_engagement_3';

UPDATE answers SET answer_text = 'There are still limited opportunities for career growth in my department.' WHERE id = 'demo_answer_employee_engagement_4';
UPDATE transcripts SET raw_text = 'There are still limited opportunities for career growth in my department.' WHERE answer_id = 'demo_answer_employee_engagement_4';

UPDATE answers SET answer_text = 'My workload has increased but staffing has not kept pace.' WHERE id = 'demo_answer_employee_engagement_5';
UPDATE transcripts SET raw_text = 'My workload has increased but staffing has not kept pace.' WHERE answer_id = 'demo_answer_employee_engagement_5';

UPDATE answers SET answer_text = 'Management has been more transparent about company decisions this quarter.' WHERE id = 'demo_answer_employee_engagement_6';
UPDATE transcripts SET raw_text = 'Management has been more transparent about company decisions this quarter.' WHERE answer_id = 'demo_answer_employee_engagement_6';

UPDATE answers SET answer_text = 'There are still limited opportunities for career growth in my department.' WHERE id = 'demo_answer_employee_engagement_7';
UPDATE transcripts SET raw_text = 'There are still limited opportunities for career growth in my department.' WHERE answer_id = 'demo_answer_employee_engagement_7';

UPDATE answers SET answer_text = 'My workload has increased but staffing has not kept pace.' WHERE id = 'demo_answer_employee_engagement_8';
UPDATE transcripts SET raw_text = 'My workload has increased but staffing has not kept pace.' WHERE answer_id = 'demo_answer_employee_engagement_8';

UPDATE answers SET answer_text = 'Management has been more transparent about company decisions this quarter.' WHERE id = 'demo_answer_employee_engagement_9';
UPDATE transcripts SET raw_text = 'Management has been more transparent about company decisions this quarter.' WHERE answer_id = 'demo_answer_employee_engagement_9';

UPDATE answers SET answer_text = 'There are still limited opportunities for career growth in my department.' WHERE id = 'demo_answer_employee_engagement_10';
UPDATE transcripts SET raw_text = 'There are still limited opportunities for career growth in my department.' WHERE answer_id = 'demo_answer_employee_engagement_10';

UPDATE answers SET answer_text = 'My workload has increased but staffing has not kept pace.' WHERE id = 'demo_answer_employee_engagement_11';
UPDATE transcripts SET raw_text = 'My workload has increased but staffing has not kept pace.' WHERE answer_id = 'demo_answer_employee_engagement_11';

UPDATE answers SET answer_text = 'Management has been more transparent about company decisions this quarter.' WHERE id = 'demo_answer_employee_engagement_12';
UPDATE transcripts SET raw_text = 'Management has been more transparent about company decisions this quarter.' WHERE answer_id = 'demo_answer_employee_engagement_12';

UPDATE answers SET answer_text = 'There are still limited opportunities for career growth in my department.' WHERE id = 'demo_answer_employee_engagement_13';
UPDATE transcripts SET raw_text = 'There are still limited opportunities for career growth in my department.' WHERE answer_id = 'demo_answer_employee_engagement_13';

UPDATE answers SET answer_text = 'My workload has increased but staffing has not kept pace.' WHERE id = 'demo_answer_employee_engagement_14';
UPDATE transcripts SET raw_text = 'My workload has increased but staffing has not kept pace.' WHERE answer_id = 'demo_answer_employee_engagement_14';
