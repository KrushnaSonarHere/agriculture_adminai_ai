from routers.agribot import chat, ChatMessage
from unittest.mock import MagicMock

db = MagicMock()
db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
db.query.return_value.limit.return_value.all.return_value = []

tests = [
    ('hello',                     'Namaste'),
    ('my application status',     'application'),
    ('payment not received',      'PM Kisan'),
    ('what documents do I need',  'Aadhaar'),
    ('helpline number',           '155261'),
    ('which scheme am I eligible','Scheme'),
    ('file a grievance',          'Grievance'),
]

for msg, expected in tests:
    res = chat(ChatMessage(message=msg, user_id=None), db)
    ok = expected.lower() in res.reply.lower()
    print(f'[{"OK  " if ok else "FAIL"}] "{msg}" -> intent={res.intent}')
